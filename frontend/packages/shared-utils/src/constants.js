/**
 * 全局业务常量（纯 JavaScript，使用 JSDoc 提供类型提示）。
 *
 * 字段命名严格对齐《智慧住家》需求文档第 5 章「数据模型参考」，
 * 扩展字段统一以 `xxx` 注释标注，方便后期替换真实后端。
 */

/** 订单状态（需求文档 3.1 订单与入住状态机） */
export const ORDER_STATUS = Object.freeze({
  PENDING_PAYMENT: 'pending_payment', // 待支付
  PAID: 'paid', // 已支付
  CONFIRMED: 'confirmed', // 已确认
  AWAITING_CHECKIN: 'awaiting_checkin', // 待入住
  CHECKED_IN: 'checked_in', // 已入住（激活设备控制权）
  COMPLETED: 'completed', // 已完成
  REVIEWED: 'reviewed', // 已评价
  CANCELLED: 'cancelled', // 已取消
  REFUNDING: 'refunding', // 退款中
  REFUNDED: 'refunded' // 已退款
})

/** 订单状态中文名 */
export const ORDER_STATUS_LABEL = Object.freeze({
  [ORDER_STATUS.PENDING_PAYMENT]: '待支付',
  [ORDER_STATUS.PAID]: '已支付',
  [ORDER_STATUS.CONFIRMED]: '已确认',
  [ORDER_STATUS.AWAITING_CHECKIN]: '待入住',
  [ORDER_STATUS.CHECKED_IN]: '已入住',
  [ORDER_STATUS.COMPLETED]: '已完成',
  [ORDER_STATUS.REVIEWED]: '已评价',
  [ORDER_STATUS.CANCELLED]: '已取消',
  [ORDER_STATUS.REFUNDING]: '退款中',
  [ORDER_STATUS.REFUNDED]: '已退款'
})

/** 订单状态主色（看板 / 时间轴 / 状态点通用） */
export const ORDER_STATUS_COLOR = Object.freeze({
  [ORDER_STATUS.PENDING_PAYMENT]: '#FAAD14',
  [ORDER_STATUS.PAID]: '#1677FF',
  [ORDER_STATUS.CONFIRMED]: '#1677FF',
  [ORDER_STATUS.AWAITING_CHECKIN]: '#13C2C2',
  [ORDER_STATUS.CHECKED_IN]: '#52C41A',
  [ORDER_STATUS.COMPLETED]: '#595959',
  [ORDER_STATUS.REVIEWED]: '#722ED1',
  [ORDER_STATUS.CANCELLED]: '#8C8C8C',
  [ORDER_STATUS.REFUNDING]: '#FA8C16',
  [ORDER_STATUS.REFUNDED]: '#CF1322'
})

/** 订单状态对应的 Element Plus Tag 类型（B 端直接使用） */
export const ORDER_STATUS_TAG = Object.freeze({
  [ORDER_STATUS.PENDING_PAYMENT]: 'warning',
  [ORDER_STATUS.PAID]: 'primary',
  [ORDER_STATUS.CONFIRMED]: 'primary',
  [ORDER_STATUS.AWAITING_CHECKIN]: 'info',
  [ORDER_STATUS.CHECKED_IN]: 'success',
  [ORDER_STATUS.COMPLETED]: 'info',
  [ORDER_STATUS.REVIEWED]: 'success',
  [ORDER_STATUS.CANCELLED]: 'info',
  [ORDER_STATUS.REFUNDING]: 'warning',
  [ORDER_STATUS.REFUNDED]: 'danger'
})

/** 客房房态（需求文档 3.2 客房房态机） */
export const ROOM_STATUS = Object.freeze({
  VACANT_READY: 'vacant_ready', // 可售
  RESERVED: 'reserved', // 已预订
  OCCUPIED: 'occupied', // 已入住
  DIRTY: 'dirty', // 脏房
  MAINTENANCE: 'maintenance' // 维修中
})

/** 房态中文名 */
export const ROOM_STATUS_LABEL = Object.freeze({
  [ROOM_STATUS.VACANT_READY]: '可售',
  [ROOM_STATUS.RESERVED]: '已预订',
  [ROOM_STATUS.OCCUPIED]: '已入住',
  [ROOM_STATUS.DIRTY]: '脏房',
  [ROOM_STATUS.MAINTENANCE]: '维修中'
})

/** 房态配色（需求：绿 / 红 / 黄 / 灰） */
export const ROOM_STATUS_COLOR = Object.freeze({
  [ROOM_STATUS.VACANT_READY]: '#52C41A',
  [ROOM_STATUS.RESERVED]: '#FAAD14',
  [ROOM_STATUS.OCCUPIED]: '#F5222D',
  [ROOM_STATUS.DIRTY]: '#8C8C8C',
  [ROOM_STATUS.MAINTENANCE]: '#2F54EB'
})

/** 房态图图例顺序 */
export const ROOM_STATUS_LEGEND = Object.freeze(
  [ROOM_STATUS.VACANT_READY, ROOM_STATUS.RESERVED, ROOM_STATUS.OCCUPIED, ROOM_STATUS.DIRTY, ROOM_STATUS.MAINTENANCE].map(
    (status) => ({ status, label: ROOM_STATUS_LABEL[status], color: ROOM_STATUS_COLOR[status] })
  )
)

/** 设备类型（需求文档 4.1.3：灯光、空调、窗帘、电视） */
export const DEVICE_TYPE = Object.freeze({
  LIGHT: 'light',
  AIR_CONDITIONER: 'air_conditioner',
  CURTAIN: 'curtain',
  TV: 'tv'
})

/** 设备类型中文名 */
export const DEVICE_TYPE_LABEL = Object.freeze({
  [DEVICE_TYPE.LIGHT]: '灯光',
  [DEVICE_TYPE.AIR_CONDITIONER]: '空调',
  [DEVICE_TYPE.CURTAIN]: '窗帘',
  [DEVICE_TYPE.TV]: '电视'
})

/** 设备类型图标（C 端设备面板使用 emoji，免静态资源依赖） */
export const DEVICE_TYPE_ICON = Object.freeze({
  [DEVICE_TYPE.LIGHT]: '💡',
  [DEVICE_TYPE.AIR_CONDITIONER]: '❄️',
  [DEVICE_TYPE.CURTAIN]: '🪟',
  [DEVICE_TYPE.TV]: '📺'
})

/** 设备在线状态 */
export const DEVICE_ONLINE_STATUS = Object.freeze({
  ONLINE: 'online',
  OFFLINE: 'offline'
})

/** 设备在线状态中文名 */
export const DEVICE_ONLINE_LABEL = Object.freeze({
  [DEVICE_ONLINE_STATUS.ONLINE]: '在线',
  [DEVICE_ONLINE_STATUS.OFFLINE]: '离线'
})

/** 空调模式 */
export const AC_MODES = Object.freeze([
  { value: 'cool', label: '制冷' },
  { value: 'heat', label: '制热' },
  { value: 'auto', label: '自动' },
  { value: 'dry', label: '除湿' },
  { value: 'fan', label: '送风' }
])

/** 空调风速 */
export const AC_FAN_SPEEDS = Object.freeze([
  { value: 'auto', label: '自动' },
  { value: 'low', label: '低风' },
  { value: 'mid', label: '中风' },
  { value: 'high', label: '高风' }
])

/**
 * 设备属性渲染配置（C 端控制面板 / B 端远程控制抽屉共用）。
 * 后续接入真实硬件时，只需把 Mock 的 properties 换成真实属性表。
 */
export const DEVICE_PROPERTY_SCHEMA = Object.freeze({
  [DEVICE_TYPE.LIGHT]: [
    { key: 'power', label: '电源', control: 'switch' },
    { key: 'brightness', label: '亮度', control: 'slider', min: 0, max: 100, step: 1, unit: '%' },
    { key: 'color_temp', label: '色温', control: 'slider', min: 3000, max: 6500, step: 100, unit: 'K' }
  ],
  [DEVICE_TYPE.AIR_CONDITIONER]: [
    { key: 'power', label: '电源', control: 'switch' },
    { key: 'temperature', label: '温度', control: 'slider', min: 16, max: 30, step: 1, unit: '℃' },
    { key: 'mode', label: '模式', control: 'select', options: AC_MODES },
    { key: 'fan_speed', label: '风速', control: 'select', options: AC_FAN_SPEEDS }
  ],
  [DEVICE_TYPE.CURTAIN]: [{ key: 'open_percent', label: '开合度', control: 'slider', min: 0, max: 100, step: 5, unit: '%' }],
  [DEVICE_TYPE.TV]: [
    { key: 'power', label: '电源', control: 'switch' },
    { key: 'volume', label: '音量', control: 'slider', min: 0, max: 100, step: 1, unit: '%' },
    { key: 'channel', label: '频道', control: 'slider', min: 1, max: 20, step: 1, unit: '台' }
  ]
})

/** 系统角色（需求文档 2. 角色与权限系统） */
export const ROLE = Object.freeze({
  CUSTOMER: 'customer',
  STORE_MANAGER: 'store_manager',
  FRONTDESK: 'frontdesk',
  FINANCE: 'finance',
  ENGINEER: 'engineer'
})

/** 角色中文名 */
export const ROLE_LABEL = Object.freeze({
  [ROLE.CUSTOMER]: '顾客',
  [ROLE.STORE_MANAGER]: '店长',
  [ROLE.FRONTDESK]: '前台',
  [ROLE.FINANCE]: '财务',
  [ROLE.ENGINEER]: '工程运维'
})

/** 角色所属端：c=顾客端，b=管理端 */
export const ROLE_SCOPE = Object.freeze({
  [ROLE.CUSTOMER]: 'c',
  [ROLE.STORE_MANAGER]: 'b',
  [ROLE.FRONTDESK]: 'b',
  [ROLE.FINANCE]: 'b',
  [ROLE.ENGINEER]: 'b'
})

/** 演示环境默认账号（Mock 登录使用） */
export const DEMO_ACCOUNTS = Object.freeze({
  customer: { phone: '13800138000', code: '1234', label: '演示顾客' },
  staff: [
    { role: ROLE.STORE_MANAGER, phone: '13900000001', label: '店长 · 王经理' },
    { role: ROLE.FRONTDESK, phone: '13900000002', label: '前台 · 李前台' },
    { role: ROLE.FINANCE, phone: '13900000003', label: '财务 · 赵会计' },
    { role: ROLE.ENGINEER, phone: '13900000004', label: '运维 · 孙工' }
  ]
})

/** 场景枚举（需求文档 4.1.3：入住、睡眠、观影、离店） */
export const SCENE_CODE = Object.freeze({
  WELCOME: 'welcome',
  SLEEP: 'sleep',
  MOVIE: 'movie',
  LEAVE: 'leave'
})

/** 升级方案范围 */
export const PLAN_SCOPE = Object.freeze([
  { value: 'room', label: '单间客房', room_count: 1 },
  { value: 'floor', label: '整层楼', room_count: 10 },
  { value: 'store', label: '整店', room_count: 50 }
])

/** 升级方案档次 */
export const PLAN_TIER = Object.freeze([
  { value: 'basic', label: '基础焕新', description: '灯光 + 窗帘电动化，低成本快速见效' },
  { value: 'comfort', label: '舒适进阶', description: '灯光 + 窗帘 + 空调智控，覆盖高频体验场景' },
  { value: 'premium', label: '旗舰尊享', description: '全屋智能联动，含影音与语音中控，打造样板房' }
])

/** 升级方案状态 */
export const PLAN_STATUS = Object.freeze({
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected'
})

/** 升级方案状态中文名 */
export const PLAN_STATUS_LABEL = Object.freeze({
  [PLAN_STATUS.DRAFT]: '草稿',
  [PLAN_STATUS.PENDING_APPROVAL]: '待审批',
  [PLAN_STATUS.APPROVED]: '已通过',
  [PLAN_STATUS.REJECTED]: '已驳回'
})

/** 告警状态 */
export const ALARM_STATUS = Object.freeze({
  PENDING: 'pending',
  HANDLED: 'handled'
})

/** 告警类型中文名 */
export const ALARM_TYPE_LABEL = Object.freeze({
  offline: '设备离线',
  sos: 'SOS 紧急呼叫',
  fault: '设备故障'
})

/** 告警等级 */
export const ALARM_LEVEL = Object.freeze({
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
})

/** 告警等级中文名 */
export const ALARM_LEVEL_LABEL = Object.freeze({
  [ALARM_LEVEL.HIGH]: '紧急',
  [ALARM_LEVEL.MEDIUM]: '重要',
  [ALARM_LEVEL.LOW]: '一般'
})

/** 通知 / 消息类型 */
export const NOTICE_TYPE = Object.freeze({
  ORDER: 'order',
  DEVICE: 'device',
  SYSTEM: 'system'
})
