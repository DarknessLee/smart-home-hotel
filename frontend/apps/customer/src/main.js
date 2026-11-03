/**
 * C 端应用入口。
 *
 * 职责：
 * 1. 创建 uni-app 的 SSR App（`createSSRApp`，uni-app Vue3 约定）；
 * 2. 注册 Pinia（所有业务数据都通过 shared-stores 的 actions 读取/修改）；
 * 3. 初始化统一请求层：C 端使用 `uni.request` 适配器，Mock 开关由 .env 控制；
 * 4. 注入 401 统一处理：清空登录态并 reLaunch 到登录页。
 *
 * 说明：token 由 shared-api 自动从本地存储读取（auth store 登录时写入），
 * 页面与组件都不需要手动拼接 Authorization 请求头。
 */
import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import { initHttp, uniRequestAdapter, clearToken } from '@smart-home/api'
import { useAuthStore } from '@smart-home/stores'
import { removeStorage } from '@smart-home/utils'
import App from './App.vue'

/** 本地存储 key（与 shared-stores/auth 保持一致，登录失效时一并清理） */
const USER_STORAGE_KEY = 'user'

/**
 * 登录页路径（hash 路由模式下 uni.reLaunch 直接使用 pages 路径）。
 * @type {string}
 */
const LOGIN_PAGE = '/pages/login/login'

/**
 * 创建应用实例。
 * @returns {{ app: import('vue').App }}
 */
export function createApp() {
  const app = createSSRApp(App)
  const pinia = createPinia()
  app.use(pinia)

  /**
   * 401 统一处理：清空内存登录态 + 本地缓存，跳转登录页。
   * （在 Pinia 创建之后再注册，保证能拿到 auth store）
   * @returns {void}
   */
  const handleUnauthorized = () => {
    const authStore = useAuthStore(pinia)
    authStore.token = ''
    authStore.user = null
    clearToken()
    removeStorage(USER_STORAGE_KEY)
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
    const current = pages[pages.length - 1]
    if (current && `/${current.route}` === LOGIN_PAGE) return
    uni.reLaunch({ url: LOGIN_PAGE })
  }

  initHttp({
    baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
    mock: import.meta.env.VITE_USE_MOCK !== 'false',
    adapter: uniRequestAdapter,
    onUnauthorized: handleUnauthorized
  })

  return { app }
}
