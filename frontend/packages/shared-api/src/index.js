/**
 * 智慧住家 - 统一 API 层出口。
 *
 * 应用入口初始化示例：
 * ```js
 * import { initHttp, uniRequestAdapter } from '@smart-home/api'
 * initHttp({ baseURL: '/api', mock: true, adapter: uniRequestAdapter })
 * ```
 * 关闭 Mock 对接真实后端：
 * ```js
 * initHttp({ baseURL: 'https://api.example.com', mock: false })
 * ```
 */
export {
  initHttp,
  request,
  http,
  uniRequestAdapter,
  getToken,
  setToken,
  clearToken,
  isMockEnabled
} from './http.js'

export {
  api,
  authApi,
  roomApi,
  orderApi,
  deviceApi,
  sceneApi,
  dashboardApi,
  alarmApi,
  planApi,
  financeApi
} from './api/index.js'

export { resetMockDb } from './mock/index.js'
