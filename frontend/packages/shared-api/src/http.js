/**
 * HTTP 请求层（axios 封装）。
 *
 * 关键设计 —— Mock 开关：
 * - `initHttp({ mock: true })` 时，请求不经过网络，直接命中 `src/mock` 中的同构实现；
 * - 后期对接真实后端时，只需 `initHttp({ mock: false, baseURL: 'https://api.xxx.com' })`，
 *   页面、Pinia、组件的代码完全不用改。
 *
 * 响应约定（与真实后端保持一致）：
 *   { code: 0, message: 'ok', data: any }        code === 0 视为成功
 *   { code: 401, message: '未登录', data: null }  非 0 视为业务失败，统一 reject
 */
import axios from 'axios'
import { getStorage, setStorage, removeStorage } from '@smart-home/utils'
import { dispatchMock } from './mock/index.js'

/** 默认配置 */
const DEFAULT_OPTIONS = {
  baseURL: '/api',
  timeout: 15000,
  mock: true,
  /** 自定义传输适配器（uni-app 传入 uni.request 适配器） */
  adapter: null,
  /** token 在本地存储中的 key（storage 工具会自动加 smh: 前缀） */
  tokenKey: 'token',
  /** 401 回调（由各端注入：跳转登录页） */
  onUnauthorized: null
}

/**
 * 全局单例 key。
 *
 * 背景：uni-app 的构建产物在某些情况下会把 shared-api 打成多份模块，
 * 如果 initHttp 只改了自己那份 module 的局部变量，就会出现
 * 「登录请求走真实接口，页面其它请求仍走 Mock」的割裂问题。
 * 因此把运行时配置与 axios 实例挂到 globalThis，保证所有副本共享同一份状态。
 */
const OPTIONS_KEY = '__SMH_HTTP_OPTIONS__'
const INSTANCE_KEY = '__SMH_HTTP_INSTANCE__'

/**
 * 读取 / 创建全局请求配置。
 * @returns {typeof DEFAULT_OPTIONS}
 */
function getGlobalOptions() {
  const root = typeof globalThis !== 'undefined' ? globalThis : null
  if (!root) return { ...DEFAULT_OPTIONS }
  if (!root[OPTIONS_KEY]) root[OPTIONS_KEY] = { ...DEFAULT_OPTIONS }
  return root[OPTIONS_KEY]
}

/** @type {typeof DEFAULT_OPTIONS} */
let options = getGlobalOptions()

/** @type {import('axios').AxiosInstance|null} */
let instance = null

/**
 * 解析后端响应（业务码 / 错误统一处理）。
 * @param {Object} response axios 风格响应
 * @returns {*} 业务 data
 */
function unwrap(response) {
  const body = response && response.data
  if (body && typeof body === 'object' && typeof body.code === 'number') {
    if (body.code === 0) return body.data
    const error = new Error(body.message || '请求失败')
    error.code = body.code
    error.data = body.data
    error.response = response
    error.isBusinessError = true
    if (body.code === 401 && typeof options.onUnauthorized === 'function') {
      options.onUnauthorized()
    }
    throw error
  }
  return body
}

/**
 * 统一错误对象（网络异常 / HTTP 错误）。
 * @param {*} error
 * @returns {Error}
 */
function normalizeError(error) {
  if (error && error.response) {
    const body = error.response.data
    const wrapped = new Error((body && body.message) || error.message || '请求失败')
    wrapped.code = (body && body.code) || error.response.status
    wrapped.status = error.response.status
    wrapped.response = error.response
    if (error.response.status === 401 && typeof options.onUnauthorized === 'function') {
      options.onUnauthorized()
    }
    return wrapped
  }
  const wrapped = new Error((error && error.message) || '网络异常，请稍后重试')
  wrapped.code = -1
  wrapped.isNetworkError = true
  return wrapped
}

/**
 * 读取 token。
 * @returns {string}
 */
export function getToken() {
  return getStorage(options.tokenKey, '') || ''
}

/**
 * 写入 token（登录成功后调用）。
 * @param {string} token
 */
export function setToken(token) {
  if (!token) {
    removeStorage(options.tokenKey)
    return
  }
  setStorage(options.tokenKey, token)
}

/**
 * 清除 token（退出登录）。
 */
export function clearToken() {
  removeStorage(options.tokenKey)
}

/**
 * uni.request 适配器：给 uni-app（APP / 小程序 / H5）使用。
 * 返回值保持 axios response 形状，方便与浏览器端共用同一套拦截逻辑。
 * @param {Object} config
 * @returns {Promise<Object>}
 */
export function uniRequestAdapter(config) {
  return new Promise((resolve, reject) => {
    if (typeof uni === 'undefined' || typeof uni.request !== 'function') {
      reject(new Error('uni.request 不可用，请检查运行环境'))
      return
    }
    const method = String(config.method || 'GET').toUpperCase()
    const baseURL = config.baseURL || ''
    let url = config.url || ''
    if (baseURL && !/^https?:\/\//i.test(url)) {
      const separator = url.startsWith('/') ? '' : '/'
      url = `${baseURL}${separator}${url}`
    }
    const useQuery = method === 'GET' || method === 'HEAD'
    uni.request({
      url,
      method,
      data: useQuery ? config.params || config.data : config.data,
      header: config.headers || {},
      timeout: config.timeout || options.timeout,
      success: (res) => {
        resolve({
          status: res.statusCode,
          statusText: '',
          headers: res.header || {},
          config,
          data: res.data
        })
      },
      fail: (error) => {
        reject(new Error((error && error.errMsg) || '网络请求失败'))
      }
    })
  })
}

/**
 * 初始化请求层（每个应用入口调用一次）。
 * @param {Partial<typeof DEFAULT_OPTIONS>} [opts]
 * @returns {import('axios').AxiosInstance}
 */
export function initHttp(opts = {}) {
  // 原地合并，保证其它模块副本持有的 options 引用同步生效
  options = getGlobalOptions()
  Object.assign(options, DEFAULT_OPTIONS, opts)
  instance = axios.create({
    baseURL: options.baseURL,
    timeout: options.timeout
  })
  const root = typeof globalThis !== 'undefined' ? globalThis : null
  if (root) root[INSTANCE_KEY] = instance

  instance.interceptors.request.use((config) => {
    const token = getToken()
    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  })

  instance.interceptors.response.use(
    (response) => unwrap(response),
    (error) => Promise.reject(normalizeError(error))
  )

  return instance
}

/**
 * 确保请求层已初始化（允许不显式调用 initHttp 的安全兜底）。
 * @returns {import('axios').AxiosInstance}
 */
function ensureInstance() {
  if (instance) return instance
  const root = typeof globalThis !== 'undefined' ? globalThis : null
  instance = (root && root[INSTANCE_KEY]) || initHttp()
  return instance
}

/**
 * 发起请求（统一出口，Mock 与真实接口共用）。
 * @param {Object} config
 * @param {string} [config.url]
 * @param {'get'|'post'|'put'|'patch'|'delete'} [config.method]
 * @param {Record<string, *>} [config.params] query 参数
 * @param {*} [config.data] 请求体
 * @param {Record<string, string>} [config.headers]
 * @param {number} [config.timeout]
 * @returns {Promise<*>} 业务 data
 */
export async function request(config = {}) {
  ensureInstance()
  const method = String(config.method || 'get').toUpperCase()
  const url = config.url || ''
  const headers = { ...(config.headers || {}) }
  const token = getToken()
  if (token && !headers.Authorization) headers.Authorization = `Bearer ${token}`

  if (options.mock) {
    const response = await dispatchMock({
      method,
      url,
      params: config.params || {},
      data: config.data === undefined ? null : config.data,
      headers
    })
    return unwrap(response)
  }

  const requestConfig = {
    ...config,
    method,
    url,
    headers,
    baseURL: config.baseURL || options.baseURL,
    timeout: config.timeout || options.timeout
  }

  if (typeof options.adapter === 'function') {
    try {
      const response = await options.adapter(requestConfig)
      return unwrap(response)
    } catch (error) {
      throw normalizeError(error)
    }
  }

  return instance.request(requestConfig)
}

/**
 * 当前 Mock 是否开启。
 * @returns {boolean}
 */
export function isMockEnabled() {
  return Boolean(options.mock)
}

/** 便捷方法集合 */
export const http = {
  request,
  /**
   * @param {string} url
   * @param {Object} [config]
   */
  get(url, config = {}) {
    return request({ ...config, url, method: 'get' })
  },
  /**
   * @param {string} url
   * @param {*} [data]
   * @param {Object} [config]
   */
  post(url, data, config = {}) {
    return request({ ...config, url, method: 'post', data })
  },
  /**
   * @param {string} url
   * @param {*} [data]
   * @param {Object} [config]
   */
  put(url, data, config = {}) {
    return request({ ...config, url, method: 'put', data })
  },
  /**
   * @param {string} url
   * @param {*} [data]
   * @param {Object} [config]
   */
  patch(url, data, config = {}) {
    return request({ ...config, url, method: 'patch', data })
  },
  /**
   * @param {string} url
   * @param {Object} [config]
   */
  del(url, config = {}) {
    return request({ ...config, url, method: 'delete' })
  }
}
