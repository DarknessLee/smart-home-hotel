/**
 * Mock 层公共辅助：错误类型、登录态解析、数据补全。
 * 所有 mock 模块只依赖本文件与 db.js，避免循环引用。
 */
import {
  ORDER_STATUS_LABEL,
  ROOM_STATUS_LABEL,
  ROOM_STATUS,
  ALARM_TYPE_LABEL,
  PLAN_STATUS_LABEL,
  DEVICE_TYPE_LABEL,
  DEVICE_ONLINE_LABEL
} from '@smart-home/utils'
import { db, findUserById, findRoom } from './db.js'

/** Mock 业务异常：code 非 0 时由 http 层转换为 rejected promise */
export class MockError extends Error {
  /**
   * @param {number} code 业务错误码
   * @param {string} message 提示文案
   */
  constructor(code, message) {
    super(message)
    this.name = 'MockError'
    this.code = code
    this.__mock = true
  }
}

/**
 * 从请求头中读取 token。
 * @param {Record<string, string>} [headers]
 * @returns {string}
 */
export function readToken(headers = {}) {
  const authorization = headers.Authorization || headers.authorization || ''
  if (typeof authorization !== 'string') return ''
  return authorization.replace(/^Bearer\s+/i, '').trim()
}

/**
 * 从 token 解析当前登录用户（Mock token 格式：mock-token-{userId}）。
 * @param {Record<string, string>} [headers]
 * @returns {Object|null}
 */
export function currentUser(headers = {}) {
  const token = readToken(headers)
  if (!token || !token.startsWith('mock-token-')) return null
  const userId = token.slice('mock-token-'.length)
  return findUserById(userId) || null
}

/**
 * 必须登录，否则抛出 401。
 * @param {Record<string, string>} [headers]
 * @returns {Object}
 */
export function requireUser(headers = {}) {
  const user = currentUser(headers)
  if (!user) throw new MockError(401, '登录已失效，请重新登录')
  return user
}

/**
 * 必须存在房间，否则抛出 404。
 * @param {string} roomId
 * @returns {Object}
 */
export function requireRoom(roomId) {
  const room = findRoom(roomId)
  if (!room) throw new MockError(404, '房间不存在')
  return room
}

/**
 * 补全房间展示字段。
 * @param {Object} room
 * @returns {Object}
 */
export function enrichRoom(room) {
  const currentOrder = room.current_order_id ? db.orders.find((order) => order.id === room.current_order_id) : null
  return {
    ...room,
    status_label: ROOM_STATUS_LABEL[room.status] || room.status,
    order_status: currentOrder?.status || '',
    order_status_label: currentOrder ? ORDER_STATUS_LABEL[currentOrder.status] : ''
  }
}

/**
 * 补全订单展示字段。
 * @param {Object} order
 * @returns {Object}
 */
export function enrichOrder(order) {
  return {
    ...order,
    status_label: ORDER_STATUS_LABEL[order.status] || order.status,
    can_control_devices: order.status === 'checked_in'
  }
}

/**
 * 补全设备展示字段。
 * @param {Object} device
 * @returns {Object}
 */
export function enrichDevice(device) {
  return {
    ...device,
    type_label: DEVICE_TYPE_LABEL[device.type] || device.type,
    online_label: DEVICE_ONLINE_LABEL[device.online_status] || device.online_status
  }
}

/**
 * 补全告警展示字段。
 * @param {Object} alarm
 * @returns {Object}
 */
export function enrichAlarm(alarm) {
  return {
    ...alarm,
    type_label: alarm.type_label || ALARM_TYPE_LABEL[alarm.type] || alarm.type
  }
}

/**
 * 补全方案展示字段。
 * @param {Object} plan
 * @returns {Object}
 */
export function enrichPlan(plan) {
  return {
    ...plan,
    status_label: PLAN_STATUS_LABEL[plan.status] || plan.status
  }
}

/**
 * 房间是否可售（下单校验）。
 * @param {Object} room
 * @returns {boolean}
 */
export function isRoomSellable(room) {
  return room.status === ROOM_STATUS.VACANT_READY
}
