/**
 * 智慧住家 - Pinia 状态模块统一出口。
 *
 * 使用方式：
 * ```js
 * import { createPinia } from 'pinia'
 * import { useAuthStore, useOrderStore } from '@smart-home/stores'
 * ```
 */
export { useAuthStore } from './modules/auth.js'
export { useAppStore } from './modules/app.js'
export { useRoomStore } from './modules/room.js'
export { useOrderStore } from './modules/order.js'
export { useDeviceStore } from './modules/device.js'
export { useSceneStore } from './modules/scene.js'
export { useDashboardStore } from './modules/dashboard.js'
export { useAlarmStore } from './modules/alarm.js'
export { usePlanStore } from './modules/plan.js'
