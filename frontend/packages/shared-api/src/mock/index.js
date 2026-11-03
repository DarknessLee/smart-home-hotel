/**
 * Mock 请求分发中心。
 *
 * 设计：一个极小的路由表（method + path 模式），handler 只关心业务，
 * 由本文件负责统一包装响应 { code, message, data }、模拟网络延迟与错误。
 * 后期切换真实后端时，只需要在 http.js 中关闭 mock 开关。
 */
import { authMock } from './modules/auth.js'
import { roomMock } from './modules/room.js'
import { orderMock } from './modules/order.js'
import { deviceMock } from './modules/device.js'
import { sceneMock } from './modules/scene.js'
import { dashboardMock } from './modules/dashboard.js'
import { alarmMock } from './modules/alarm.js'
import { planMock } from './modules/plan.js'
import { financeMock } from './modules/finance.js'
import { MockError } from './helpers.js'
import { db } from './db.js'

/** 全部 Mock 模块的路由表 */
const ROUTES = [
  ...authMock,
  ...roomMock,
  ...orderMock,
  ...deviceMock,
  ...sceneMock,
  ...dashboardMock,
  ...alarmMock,
  ...planMock,
  ...financeMock
]

/**
 * 睡眠指定毫秒。
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 解析 query string。
 * @param {string} search
 * @returns {Record<string, string>}
 */
function parseQuery(search) {
  /** @type {Record<string, string>} */
  const query = {}
  if (!search) return query
  search
    .replace(/^\?/, '')
    .split('&')
    .filter(Boolean)
    .forEach((pair) => {
      const [rawKey, rawValue = ''] = pair.split('=')
      try {
        query[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue)
      } catch (error) {
        query[rawKey] = rawValue
      }
    })
  return query
}

/**
 * 路径匹配：支持 /orders/:id 形式的动态段。
 * @param {string} pattern 路由模板
 * @param {string} path 实际路径
 * @returns {Record<string, string>|null} 命中返回 params，否则 null
 */
function matchPath(pattern, path) {
  const patternSegments = pattern.replace(/\/+$/, '').split('/').filter(Boolean)
  const pathSegments = path.replace(/\/+$/, '').split('/').filter(Boolean)
  if (patternSegments.length !== pathSegments.length) return null
  /** @type {Record<string, string>} */
  const params = {}
  for (let index = 0; index < patternSegments.length; index += 1) {
    const patternSegment = patternSegments[index]
    const pathSegment = pathSegments[index]
    if (patternSegment.startsWith(':')) {
      params[patternSegment.slice(1)] = decodeURIComponent(pathSegment)
    } else if (patternSegment !== pathSegment) {
      return null
    }
  }
  return params
}

/**
 * 默认网络延迟：模拟真实接口 240~520ms。
 * @returns {number}
 */
function defaultDelay() {
  return 240 + Math.floor(Math.random() * 280)
}

/**
 * 构造成功响应（axios response 形状）。
 * @param {*} data
 * @returns {Object}
 */
function successResponse(data) {
  return {
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {},
    data: { code: 0, message: 'ok', data }
  }
}

/**
 * 构造业务失败响应（HTTP 仍为 200，业务 code 非 0，与真实后端保持一致）。
 * @param {number} code
 * @param {string} message
 * @returns {Object}
 */
function failureResponse(code, message) {
  return {
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {},
    data: { code, message, data: null }
  }
}

/**
 * 分发 Mock 请求。
 * @param {Object} request
 * @param {string} request.method HTTP 方法（大写）
 * @param {string} request.url 接口路径
 * @param {Record<string, string>} [request.params] query 参数
 * @param {*} [request.data] 请求体
 * @param {Record<string, string>} [request.headers] 请求头
 * @returns {Promise<Object>} axios 风格响应
 */
export async function dispatchMock({ method, url, params = {}, data = null, headers = {} }) {
  const [rawPath, rawSearch] = String(url || '').split('?')
  const query = { ...parseQuery(rawSearch), ...params }
  const normalizedMethod = String(method || 'GET').toUpperCase()

  for (const route of ROUTES) {
    if (route.method !== normalizedMethod) continue
    const pathParams = matchPath(route.path, rawPath)
    if (!pathParams) continue

    if (route.delay !== 0) {
      await sleep(route.delay ?? defaultDelay())
    }

    try {
      const result = await route.handler({
        params: pathParams,
        query,
        body: data && typeof data === 'object' ? data : {},
        headers,
        db
      })
      return successResponse(result)
    } catch (error) {
      if (error instanceof MockError) {
        return failureResponse(error.code, error.message)
      }
      console.error('[mock] handler error:', normalizedMethod, rawPath, error)
      return failureResponse(500, error?.message || 'Mock 服务内部错误')
    }
  }

  return failureResponse(404, `Mock 接口未实现：${normalizedMethod} ${rawPath}`)
}

/** Mock 重置（演示用） */
export function resetMockDb() {
  if (typeof window !== 'undefined' && window.location) window.location.reload()
}
