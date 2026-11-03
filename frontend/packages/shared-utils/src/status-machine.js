/**
 * 业务状态机（前端 Mock 阶段必须可流转）。
 *
 * 设计原则：
 * 1. 状态与流转规则只在 shared-utils 定义一次，C 端、B 端、后端三方共用同一份枚举；
 * 2. API 层（shared-api/mock）与 UI 层（Pinia getter / 按钮可见性）都调用本文件，
 *    禁止在页面里硬编码状态字符串；
 * 3. 后续对接真实后端时，状态值保持不变（与需求文档数据字典一致）。
 */
import { ORDER_STATUS, ROOM_STATUS } from './constants.js'

/**
 * 订单状态流转表：key 为当前状态，value 为允许进入的下一个状态数组。
 * 对应需求文档 3.1：
 * 待支付 -> 已支付/已确认 -> 待入住 -> 已入住 -> 已完成 -> 已评价
 *   |           |
 *   +-> 已取消  +-> 退款中 -> 已退款
 */
export const ORDER_TRANSITIONS = Object.freeze({
  [ORDER_STATUS.PENDING_PAYMENT]: [ORDER_STATUS.PAID, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PAID]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.REFUNDING],
  [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.AWAITING_CHECKIN, ORDER_STATUS.CHECKED_IN, ORDER_STATUS.REFUNDING],
  [ORDER_STATUS.AWAITING_CHECKIN]: [ORDER_STATUS.CHECKED_IN, ORDER_STATUS.REFUNDING],
  [ORDER_STATUS.CHECKED_IN]: [ORDER_STATUS.COMPLETED],
  [ORDER_STATUS.COMPLETED]: [ORDER_STATUS.REVIEWED],
  [ORDER_STATUS.REFUNDING]: [ORDER_STATUS.REFUNDED],
  [ORDER_STATUS.REVIEWED]: [],
  [ORDER_STATUS.CANCELLED]: [],
  [ORDER_STATUS.REFUNDED]: []
})

/**
 * 房态流转表（需求文档 3.2）：
 * 可售 -> 已预订 -> 已入住 -> 脏房 -> 维修中 -> 可售
 */
export const ROOM_TRANSITIONS = Object.freeze({
  [ROOM_STATUS.VACANT_READY]: [ROOM_STATUS.RESERVED, ROOM_STATUS.MAINTENANCE],
  [ROOM_STATUS.RESERVED]: [ROOM_STATUS.OCCUPIED, ROOM_STATUS.VACANT_READY],
  [ROOM_STATUS.OCCUPIED]: [ROOM_STATUS.DIRTY],
  [ROOM_STATUS.DIRTY]: [ROOM_STATUS.VACANT_READY],
  [ROOM_STATUS.MAINTENANCE]: [ROOM_STATUS.VACANT_READY]
})

/**
 * 订单操作定义（同时承担「按钮如何展示」与「API 如何流转」两份职责）。
 * @typedef {Object} OrderActionDef
 * @property {string} label 按钮文案
 * @property {string} to 目标状态
 * @property {string[]} from 允许的起始状态
 * @property {string[]} audience 可见角色端：customer / staff
 * @property {'primary'|'success'|'warning'|'danger'|'info'} type 按钮风格
 * @property {boolean} [confirm] 是否需要二次确认弹窗
 */
export const ORDER_ACTIONS = Object.freeze({
  pay: {
    label: '立即支付',
    to: ORDER_STATUS.CONFIRMED,
    from: [ORDER_STATUS.PENDING_PAYMENT],
    audience: ['customer'],
    type: 'primary'
  },
  cancel: {
    label: '取消订单',
    to: ORDER_STATUS.CANCELLED,
    from: [ORDER_STATUS.PENDING_PAYMENT],
    audience: ['customer', 'staff'],
    type: 'info',
    confirm: true
  },
  checkIn: {
    label: '办理入住',
    to: ORDER_STATUS.CHECKED_IN,
    from: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.AWAITING_CHECKIN],
    audience: ['customer', 'staff'],
    type: 'primary'
  },
  checkOut: {
    label: '办理退房',
    to: ORDER_STATUS.COMPLETED,
    from: [ORDER_STATUS.CHECKED_IN],
    audience: ['staff'],
    type: 'warning',
    confirm: true
  },
  refund: {
    label: '申请退款',
    to: ORDER_STATUS.REFUNDING,
    from: [ORDER_STATUS.PAID, ORDER_STATUS.CONFIRMED, ORDER_STATUS.AWAITING_CHECKIN],
    audience: ['customer'],
    type: 'warning',
    confirm: true
  },
  confirmRefund: {
    label: '确认退款',
    to: ORDER_STATUS.REFUNDED,
    from: [ORDER_STATUS.REFUNDING],
    audience: ['staff'],
    type: 'danger',
    confirm: true
  },
  review: {
    label: '去评价',
    to: ORDER_STATUS.REVIEWED,
    from: [ORDER_STATUS.COMPLETED],
    audience: ['customer'],
    type: 'primary'
  }
})

/**
 * 判断订单状态流转是否合法。
 * @param {string} from 当前状态
 * @param {string} to 目标状态
 * @returns {boolean}
 */
export function canOrderTransition(from, to) {
  return Boolean(ORDER_TRANSITIONS[from] && ORDER_TRANSITIONS[from].includes(to))
}

/**
 * 判断房态流转是否合法。
 * @param {string} from 当前状态
 * @param {string} to 目标状态
 * @returns {boolean}
 */
export function canRoomTransition(from, to) {
  return Boolean(ROOM_TRANSITIONS[from] && ROOM_TRANSITIONS[from].includes(to))
}

/**
 * 获取当前订单状态下可执行的操作。
 * @param {string} status 订单状态
 * @param {'customer'|'staff'} audience 访问端
 * @returns {Array<{ action: string, label: string, to: string, type: string, confirm: boolean }>}
 */
export function getOrderActions(status, audience = 'customer') {
  return Object.entries(ORDER_ACTIONS)
    .filter(([, def]) => def.from.includes(status) && def.audience.includes(audience))
    .map(([action, def]) => ({
      action,
      label: def.label,
      to: def.to,
      type: def.type,
      confirm: Boolean(def.confirm)
    }))
}

/**
 * 根据操作名读取操作定义。
 * @param {string} action
 * @returns {OrderActionDef | undefined}
 */
export function getOrderAction(action) {
  return ORDER_ACTIONS[action]
}

/**
 * 订单是否处于「进行中」（用于列表分组 / 看板统计）。
 * @param {string} status
 * @returns {boolean}
 */
export function isActiveOrder(status) {
  return [
    ORDER_STATUS.PENDING_PAYMENT,
    ORDER_STATUS.PAID,
    ORDER_STATUS.CONFIRMED,
    ORDER_STATUS.AWAITING_CHECKIN,
    ORDER_STATUS.CHECKED_IN
  ].includes(status)
}

/**
 * 订单是否可以控制房间设备（需求：已入住后激活设备控制权）。
 * @param {string} status
 * @returns {boolean}
 */
export function canControlDevices(status) {
  return status === ORDER_STATUS.CHECKED_IN
}
