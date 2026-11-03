/**
 * 路由与登录守卫（页面统一从这里跳转，避免散落硬编码路径）。
 *
 * 约定：
 * - tabBar 页面必须使用 `uni.switchTab`，其他页面使用 `uni.navigateTo`；
 * - 页面 onShow / onLoad 第一行调用 `ensureLoggedIn()`，未登录自动回登录页。
 */
import { useAuthStore } from '@smart-home/stores'

/** 页面路由表 */
export const ROUTES = Object.freeze({
  LOGIN: '/pages/login/login',
  INDEX: '/pages/index/index',
  ROOMS: '/pages/rooms/rooms',
  ROOM_DETAIL: '/pages/rooms/detail',
  ORDER_CREATE: '/pages/order/create',
  ORDER_LIST: '/pages/order/list',
  ORDER_DETAIL: '/pages/order/detail',
  CHECKIN: '/pages/checkin/checkin',
  DEVICE: '/pages/device/device',
  PROFILE: '/pages/profile/profile'
})

/** tabBar 页面（需要 switchTab 跳转） */
const TAB_PAGES = [ROUTES.INDEX, ROUTES.ROOMS, ROUTES.DEVICE, ROUTES.PROFILE]

/**
 * 去掉 query 后判断是否为 tabBar 页面。
 * @param {string} url
 * @returns {boolean}
 */
export function isTabPage(url) {
  const path = String(url || '').split('?')[0]
  return TAB_PAGES.includes(path)
}

/**
 * 跳转页面（自动区分 tabBar / 普通页面）。
 * @param {string} url
 * @returns {void}
 */
export function navigate(url) {
  if (isTabPage(url)) {
    uni.switchTab({ url })
    return
  }
  uni.navigateTo({ url })
}

/**
 * 关闭当前页并跳转（下单成功后进入订单详情等场景）。
 * @param {string} url
 * @returns {void}
 */
export function replace(url) {
  if (isTabPage(url)) {
    uni.switchTab({ url })
    return
  }
  uni.redirectTo({ url })
}

/**
 * 回到登录页。
 * @returns {void}
 */
export function goLogin() {
  uni.reLaunch({ url: ROUTES.LOGIN })
}

/**
 * 登录守卫：未登录直接 reLaunch 到登录页。
 * @returns {boolean} 是否已登录
 */
export function ensureLoggedIn() {
  const authStore = useAuthStore()
  if (authStore.isLoggedIn) return true
  goLogin()
  return false
}
