/**
 * 业务接口统一出口：C 端与 B 端共用同一套接口定义（需求文档 Prompt 指南）。
 */
export { authApi } from './auth.js'
export { roomApi } from './room.js'
export { orderApi } from './order.js'
export { deviceApi } from './device.js'
export { sceneApi } from './scene.js'
export { dashboardApi } from './dashboard.js'
export { alarmApi } from './alarm.js'
export { planApi } from './plan.js'
export { financeApi } from './finance.js'

import { authApi } from './auth.js'
import { roomApi } from './room.js'
import { orderApi } from './order.js'
import { deviceApi } from './device.js'
import { sceneApi } from './scene.js'
import { dashboardApi } from './dashboard.js'
import { alarmApi } from './alarm.js'
import { planApi } from './plan.js'
import { financeApi } from './finance.js'

/** 命名空间方式调用：api.room.getRooms() */
export const api = {
  auth: authApi,
  room: roomApi,
  order: orderApi,
  device: deviceApi,
  scene: sceneApi,
  dashboard: dashboardApi,
  alarm: alarmApi,
  plan: planApi,
  finance: financeApi
}
