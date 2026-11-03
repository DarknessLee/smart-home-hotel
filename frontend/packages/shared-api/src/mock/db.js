/**
 * Mock 业务数据库（内存态）。
 *
 * 职责：
 * 1. 生成符合《需求文档》第 5 章数据字典规范的演示数据；
 * 2. 提供订单状态机、房态机的「写操作」唯一入口，保证 Mock 内部数据一致；
 * 3. 生成的数据结构与真实后端返回结构完全一致，后期删掉 mock 目录即可切换真实接口。
 *
 * 注意：这是开发期 Mock 数据库，只在浏览器内存中存在，刷新页面会重置。
 * 后续接入真实后端时，整个 mock 目录不需要参与打包（由 http 层开关隔离）。
 */
import {
  ORDER_STATUS,
  ROOM_STATUS,
  DEVICE_TYPE,
  DEVICE_ONLINE_STATUS,
  PLAN_SCOPE,
  PLAN_TIER,
  PLAN_STATUS,
  ALARM_STATUS,
  ALARM_LEVEL,
  ALARM_TYPE_LABEL,
  SCENE_CODE,
  ORDER_STATUS_LABEL,
  ROOM_STATUS_LABEL
} from '@smart-home/utils'

const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000
const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/** 固定随机种子，保证每次刷新 Mock 数据一致 */
function mulberry32(seed) {
  return function random() {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const random = mulberry32(20261021)

/**
 * 取 [min, max] 之间的整数。
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function randomInt(min, max) {
  return Math.floor(random() * (max - min + 1)) + min
}

/**
 * 从数组中随机取一项。
 * @template T
 * @param {T[]} list
 * @returns {T}
 */
function pick(list) {
  return list[randomInt(0, list.length - 1)]
}

/**
 * 补零。
 * @param {number} value
 * @param {number} [length=2]
 * @returns {string}
 */
function pad(value, length = 2) {
  return String(value).padStart(length, '0')
}

/**
 * 格式化日期时间（YYYY-MM-DD HH:mm）。
 * @param {number|Date} timestamp
 * @returns {string}
 */
export function formatDateTime(timestamp) {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`
}

/**
 * 格式化日期（YYYY-MM-DD）。
 * @param {number|Date} timestamp
 * @returns {string}
 */
export function formatDate(timestamp) {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * 今天零点时间戳。
 * @returns {number}
 */
function startOfToday() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

const TODAY = startOfToday()

// ---------------------------------------------------------------------------
// 基础数据：门店 / 房型
// ---------------------------------------------------------------------------

/** @type {Array<{ id: string, name: string, address: string, phone: string, room_count: number }>} */
export const stores = [
  {
    id: 'ST001',
    name: '智慧住家·未来城旗舰店',
    address: '滨江市未来城科技大道 88 号',
    phone: '0571-8888 6666',
    room_count: 50
  }
]

/** 房型（颜色用于前端无图占位渲染） */
export const roomTypes = [
  {
    id: 'RT01',
    store_id: 'ST001',
    name: '轻享大床房',
    price: 399,
    area: 28,
    bed_type: '1.8m 大床',
    capacity: 2,
    cover_color: '#5B8DEF',
    tags: ['智能灯光', '电动窗帘', '免费早餐'],
    description: '28㎡ 舒适空间，配电动窗帘与全屋智能灯光，一键切换入住 / 睡眠场景。'
  },
  {
    id: 'RT02',
    store_id: 'ST001',
    name: '悦享双床房',
    price: 459,
    area: 32,
    bed_type: '1.2m 双床',
    capacity: 2,
    cover_color: '#36CFC9',
    tags: ['双床', '智能空调', '高速 WiFi'],
    description: '32㎡ 双床房，适合朋友出行，空调与灯光支持语音与面板双控。'
  },
  {
    id: 'RT03',
    store_id: 'ST001',
    name: '亲子家庭房',
    price: 599,
    area: 45,
    bed_type: '1.8m 大床 + 1.2m 儿童床',
    capacity: 3,
    cover_color: '#FFA940',
    tags: ['亲子主题', '儿童洗漱台', '智能安防'],
    description: '45㎡ 家庭房，儿童友好设计，配备智能安防与一键睡眠场景。'
  },
  {
    id: 'RT04',
    store_id: 'ST001',
    name: '巨幕影音房',
    price: 699,
    area: 38,
    bed_type: '2.0m 大床',
    capacity: 2,
    cover_color: '#9254DE',
    tags: ['120 寸巨幕', '环绕音响', '观影场景'],
    description: '38㎡ 影音主题房，一键观影场景自动熄灯、拉帘、开启巨幕。'
  },
  {
    id: 'RT05',
    store_id: 'ST001',
    name: '行政套房',
    price: 999,
    area: 60,
    bed_type: '2.0m 大床',
    capacity: 2,
    cover_color: '#F759AB',
    tags: ['独立客厅', '智能管家', '行政酒廊'],
    description: '60㎡ 行政套房，独立客厅 + 智能管家，覆盖全屋十二路智能设备。'
  }
]

// ---------------------------------------------------------------------------
// 客房（50 间，楼层 3~7，每层 10 间）
// 房态分布：可售 / 已预订 / 已入住 / 脏房 / 维修中 均有覆盖
// ---------------------------------------------------------------------------

const ROOM_STATUS_PATTERN = [
  ROOM_STATUS.OCCUPIED,
  ROOM_STATUS.OCCUPIED,
  ROOM_STATUS.VACANT_READY,
  ROOM_STATUS.RESERVED,
  ROOM_STATUS.OCCUPIED,
  ROOM_STATUS.DIRTY,
  ROOM_STATUS.VACANT_READY,
  ROOM_STATUS.MAINTENANCE,
  ROOM_STATUS.VACANT_READY,
  ROOM_STATUS.RESERVED
]

const GUEST_NAMES = [
  '张伟', '王芳', '李娜', '刘洋', '陈静', '杨帆', '赵磊', '周敏', '吴强', '徐丽',
  '孙涛', '马超', '朱琳', '胡军', '郭敏', '何平', '林峰', '高源', '罗静', '梁宇',
  '宋佳', '谢东', '韩雪', '唐杰', '冯雪', '邓超', '曹阳', '彭博', '曾丽', '苏航'
]

/**
 * 生成手机号（演示数据）。
 * @param {number} index
 * @returns {string}
 */
function guestPhone(index) {
  return `139${String(10000000 + index * 137).slice(-8)}`
}

/** @type {Array<Object>} */
const rooms = []

for (let floor = 3; floor <= 7; floor += 1) {
  for (let index = 1; index <= 10; index += 1) {
    const seq = (floor - 3) * 10 + (index - 1)
    const type = roomTypes[seq % roomTypes.length]
    const roomNo = `${floor}${pad(index)}`
    rooms.push({
      id: `R${roomNo}`,
      store_id: 'ST001',
      room_no: roomNo,
      type_name: type.name,
      room_type_id: type.id,
      price: type.price,
      status: ROOM_STATUS_PATTERN[seq % ROOM_STATUS_PATTERN.length],
      floor,
      // 以下为扩展字段：房态图 / 前台工作台展示所需
      guest_name: '',
      guest_phone: '',
      check_in_time: '',
      check_out_time: '',
      current_order_id: '',
      key_card_no: ''
    })
  }
}

// ---------------------------------------------------------------------------
// 用户（顾客 + B 端员工）
// ---------------------------------------------------------------------------

/** 演示顾客：已实名、已入住在 R305，可直接体验设备控制 */
export const users = [
  {
    id: 'U1000',
    phone: '13800138000',
    real_name: '张小明',
    id_card: '330106199003075678',
    status: 'normal',
    role: 'customer',
    current_room_id: 'R305',
    created_at: formatDateTime(TODAY - 90 * DAY)
  },
  {
    id: 'ST1001',
    phone: '13900000001',
    real_name: '王经理',
    id_card: '',
    status: 'normal',
    role: 'store_manager',
    current_room_id: '',
    created_at: formatDateTime(TODAY - 400 * DAY)
  },
  {
    id: 'ST1002',
    phone: '13900000002',
    real_name: '李前台',
    id_card: '',
    status: 'normal',
    role: 'frontdesk',
    current_room_id: '',
    created_at: formatDateTime(TODAY - 300 * DAY)
  },
  {
    id: 'ST1003',
    phone: '13900000003',
    real_name: '赵会计',
    id_card: '',
    status: 'normal',
    role: 'finance',
    current_room_id: '',
    created_at: formatDateTime(TODAY - 250 * DAY)
  },
  {
    id: 'ST1004',
    phone: '13900000004',
    real_name: '孙工',
    id_card: '',
    status: 'normal',
    role: 'engineer',
    current_room_id: '',
    created_at: formatDateTime(TODAY - 200 * DAY)
  }
]

// ---------------------------------------------------------------------------
// 订单
// ---------------------------------------------------------------------------

const orders = []
let orderSeq = 1

/**
 * 生成订单号：ORD + 当天日期 + 3 位流水。
 * @param {number} timestamp
 * @returns {string}
 */
function nextOrderNo(timestamp) {
  const date = new Date(timestamp)
  return `ORD${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(orderSeq, 3)}`
}

/**
 * 创建订单（Mock 内部使用）。
 * @param {Object} params
 * @param {string} params.roomId
 * @param {Object} params.user
 * @param {string} params.status
 * @param {number} params.checkInAt
 * @param {number} params.checkOutAt
 * @param {Object} [params.extra]
 * @returns {Object} 订单实体
 */
function createOrderEntity({ roomId, user, status, checkInAt, checkOutAt, extra = {} }) {
  const room = rooms.find((item) => item.id === roomId)
  if (!room) throw new Error(`[mock] room not found: ${roomId}`)
  const nights = Math.max(1, Math.round((checkOutAt - checkInAt) / DAY))
  const amount = room.price * nights
  const createdAt = checkInAt - 3 * DAY
  const order = {
    id: `ORD_${Date.now()}_${orderSeq}`,
    order_no: nextOrderNo(createdAt),
    user_id: user.id,
    room_id: room.id,
    room_type_id: room.room_type_id,
    room_no: room.room_no,
    type_name: room.type_name,
    price: room.price,
    nights,
    amount,
    status,
    check_in_time: formatDateTime(checkInAt),
    check_out_time: formatDateTime(checkOutAt),
    guest_name: user.real_name || extra.guest_name || '散客',
    guest_phone: user.phone,
    created_at: formatDateTime(createdAt),
    paid_at: '',
    checked_in_at: '',
    checked_out_at: '',
    cancelled_at: '',
    refund_reason: '',
    remark: '',
    source: extra.source || 'c_app',
    review_id: extra.review_id || '',
    ...extra
  }
  orderSeq += 1

  // 按订单状态同步房态与房间住客信息（房态机 3.2）
  if ([ORDER_STATUS.PAID, ORDER_STATUS.CONFIRMED, ORDER_STATUS.AWAITING_CHECKIN].includes(status)) {
    room.status = ROOM_STATUS.RESERVED
    room.guest_name = order.guest_name
    room.guest_phone = order.guest_phone
    room.check_in_time = order.check_in_time
    room.check_out_time = order.check_out_time
    room.current_order_id = order.id
  }
  if (status === ORDER_STATUS.CHECKED_IN) {
    room.status = ROOM_STATUS.OCCUPIED
    room.guest_name = order.guest_name
    room.guest_phone = order.guest_phone
    room.check_in_time = order.check_in_time
    room.check_out_time = order.check_out_time
    room.current_order_id = order.id
    order.checked_in_at = order.check_in_time
  }
  if ([ORDER_STATUS.COMPLETED, ORDER_STATUS.REVIEWED].includes(status)) {
    room.status = ROOM_STATUS.DIRTY
    room.current_order_id = ''
  }
  orders.push(order)
  return order
}

/** 演示顾客的订单（覆盖需求文档状态机的大部分节点） */
const demoUser = users[0]

// 已入住（当前可控制 R305 设备）
createOrderEntity({
  roomId: 'R305',
  user: demoUser,
  status: ORDER_STATUS.CHECKED_IN,
  checkInAt: TODAY - 1 * DAY + 14 * HOUR,
  checkOutAt: TODAY + 2 * DAY + 12 * HOUR,
  extra: { paid_at: formatDateTime(TODAY - 2 * DAY + 10 * HOUR) }
})

// 待支付（R303 已预订，等待顾客支付）
createOrderEntity({
  roomId: 'R303',
  user: demoUser,
  status: ORDER_STATUS.PENDING_PAYMENT,
  checkInAt: TODAY + 1 * DAY + 14 * HOUR,
  checkOutAt: TODAY + 3 * DAY + 12 * HOUR
})

// 已取消（R307 维持可售）
const cancelledOrder = createOrderEntity({
  roomId: 'R307',
  user: demoUser,
  status: ORDER_STATUS.PENDING_PAYMENT,
  checkInAt: TODAY - 2 * DAY + 14 * HOUR,
  checkOutAt: TODAY - 1 * DAY + 12 * HOUR
})
cancelledOrder.status = ORDER_STATUS.CANCELLED
cancelledOrder.cancelled_at = formatDateTime(TODAY - 3 * DAY + 9 * HOUR)

// 已评价（R409 历史订单）
const reviewedOrder = createOrderEntity({
  roomId: 'R409',
  user: demoUser,
  status: ORDER_STATUS.COMPLETED,
  checkInAt: TODAY - 8 * DAY + 14 * HOUR,
  checkOutAt: TODAY - 6 * DAY + 12 * HOUR,
  extra: { checked_out_at: formatDateTime(TODAY - 6 * DAY + 12 * HOUR) }
})
reviewedOrder.status = ORDER_STATUS.REVIEWED

// 已完成未评价（R309）：用于演示顾客「去评价」流程
createOrderEntity({
  roomId: 'R309',
  user: demoUser,
  status: ORDER_STATUS.COMPLETED,
  checkInAt: TODAY - 4 * DAY + 14 * HOUR,
  checkOutAt: TODAY - 2 * DAY + 12 * HOUR,
  extra: { checked_out_at: formatDateTime(TODAY - 2 * DAY + 12 * HOUR) }
})

// 退款中（其他客人，R507）
const refundingOrder = createOrderEntity({
  roomId: 'R507',
  user: { id: 'U2001', phone: '13700001111', real_name: '钱女士' },
  status: ORDER_STATUS.REFUNDING,
  checkInAt: TODAY + 4 * DAY + 14 * HOUR,
  checkOutAt: TODAY + 6 * DAY + 12 * HOUR,
  extra: { refund_reason: '行程变更，申请取消预订' }
})
// 退款中订单仍占房（预订保留至退款完成）
const refundingRoom = rooms.find((room) => room.id === 'R507')
if (refundingRoom) {
  refundingRoom.status = ROOM_STATUS.RESERVED
  refundingRoom.guest_name = refundingOrder.guest_name
  refundingRoom.guest_phone = refundingOrder.guest_phone
  refundingRoom.check_in_time = refundingOrder.check_in_time
  refundingRoom.check_out_time = refundingOrder.check_out_time
  refundingRoom.current_order_id = refundingOrder.id
}

// 其他客房的进行中 / 历史订单（让 B 端订单列表与看板有数据）
let guestSeq = 0
rooms.forEach((room) => {
  if (['R303', 'R305', 'R307', 'R309', 'R409', 'R507'].includes(room.id)) return
  const guest = {
    id: `U${2000 + guestSeq}`,
    phone: guestPhone(guestSeq),
    real_name: GUEST_NAMES[guestSeq % GUEST_NAMES.length]
  }
  guestSeq += 1

  if (room.status === ROOM_STATUS.OCCUPIED) {
    createOrderEntity({
      roomId: room.id,
      user: guest,
      status: ORDER_STATUS.CHECKED_IN,
      checkInAt: TODAY - randomInt(1, 3) * DAY + 14 * HOUR,
      checkOutAt: TODAY + randomInt(1, 4) * DAY + 12 * HOUR
    })
  } else if (room.status === ROOM_STATUS.RESERVED) {
    createOrderEntity({
      roomId: room.id,
      user: guest,
      status: random() > 0.5 ? ORDER_STATUS.CONFIRMED : ORDER_STATUS.AWAITING_CHECKIN,
      checkInAt: TODAY + randomInt(1, 5) * DAY + 14 * HOUR,
      checkOutAt: TODAY + randomInt(6, 9) * DAY + 12 * HOUR
    })
  } else if (room.status === ROOM_STATUS.DIRTY) {
    createOrderEntity({
      roomId: room.id,
      user: guest,
      status: ORDER_STATUS.COMPLETED,
      checkInAt: TODAY - randomInt(2, 6) * DAY + 14 * HOUR,
      checkOutAt: TODAY - 1 * DAY + 12 * HOUR,
      extra: { checked_out_at: formatDateTime(TODAY - 1 * DAY + 12 * HOUR) }
    })
  }
})

// ---------------------------------------------------------------------------
// 评价
// ---------------------------------------------------------------------------

export const reviews = [
  {
    id: 'RV1001',
    order_id: reviewedOrder.id,
    order_no: reviewedOrder.order_no,
    room_id: 'R409',
    room_no: '409',
    user_id: demoUser.id,
    user_name: demoUser.real_name,
    rating: 5,
    content: '一键睡眠场景非常丝滑，窗帘和灯光联动很舒服，会再来。',
    created_at: formatDateTime(TODAY - 5 * DAY + 10 * HOUR)
  },
  {
    id: 'RV1002',
    order_id: orders.find((item) => item.status === ORDER_STATUS.COMPLETED)?.id || '',
    order_no: orders.find((item) => item.status === ORDER_STATUS.COMPLETED)?.order_no || '',
    room_id: 'R401',
    room_no: '401',
    user_id: 'U2011',
    user_name: '吴强',
    rating: 4,
    content: '设备响应很快，就是空调面板的字体可以再大一点。',
    created_at: formatDateTime(TODAY - 3 * DAY + 16 * HOUR)
  }
]

// ---------------------------------------------------------------------------
// 设备（每间客房 4 路：灯光 / 空调 / 窗帘 / 电视）
// ---------------------------------------------------------------------------

const DEVICE_DEFINITIONS = [
  {
    type: DEVICE_TYPE.LIGHT,
    suffix: 'LIGHT',
    name: '智能灯光',
    properties: { power: false, brightness: 60, color_temp: 4000 }
  },
  {
    type: DEVICE_TYPE.AIR_CONDITIONER,
    suffix: 'AC',
    name: '智能空调',
    properties: { power: false, mode: 'cool', temperature: 26, fan_speed: 'auto' }
  },
  {
    type: DEVICE_TYPE.CURTAIN,
    suffix: 'CURTAIN',
    name: '电动窗帘',
    properties: { open_percent: 0 }
  },
  {
    type: DEVICE_TYPE.TV,
    suffix: 'TV',
    name: '智能电视',
    properties: { power: false, volume: 30, channel: 1 }
  }
]

/** @type {Array<Object>} */
export const devices = []

rooms.forEach((room) => {
  DEVICE_DEFINITIONS.forEach((definition, index) => {
    const occupied = room.status === ROOM_STATUS.OCCUPIED
    const properties = { ...definition.properties }
    if (occupied) {
      if (definition.type === DEVICE_TYPE.LIGHT) Object.assign(properties, { power: true, brightness: 80 })
      if (definition.type === DEVICE_TYPE.AIR_CONDITIONER) Object.assign(properties, { power: true, temperature: 24 })
      if (definition.type === DEVICE_TYPE.CURTAIN) Object.assign(properties, { open_percent: 100 })
    }
    devices.push({
      id: `DEV-${room.room_no}-${definition.suffix}`,
      room_id: room.id,
      room_no: room.room_no,
      sn: `SN-${room.room_no}-${pad(index + 1)}`,
      type: definition.type,
      name: definition.name,
      online_status: DEVICE_ONLINE_STATUS.ONLINE,
      properties,
      firmware: '1.4.2',
      last_heartbeat: formatDateTime(Date.now() - randomInt(1, 30) * 60 * 1000)
    })
  })
})

// 制造 1 台离线设备，供告警中心演示
const offlineDevice = devices.find((item) => item.id === 'DEV-310-LIGHT')
if (offlineDevice) {
  offlineDevice.online_status = DEVICE_ONLINE_STATUS.OFFLINE
  offlineDevice.properties.power = false
}

// ---------------------------------------------------------------------------
// 场景（需求文档 4.1.3：入住、睡眠、观影、离店）
// actions 结构：{ device_type, property, value }
// ---------------------------------------------------------------------------

export const scenes = [
  {
    id: 'SCENE_WELCOME',
    code: SCENE_CODE.WELCOME,
    name: '入住模式',
    icon: '🏠',
    description: '拉开窗帘、点亮暖光、空调 24℃',
    actions: [
      { device_type: DEVICE_TYPE.LIGHT, property: 'power', value: true },
      { device_type: DEVICE_TYPE.LIGHT, property: 'brightness', value: 80 },
      { device_type: DEVICE_TYPE.LIGHT, property: 'color_temp', value: 3500 },
      { device_type: DEVICE_TYPE.AIR_CONDITIONER, property: 'power', value: true },
      { device_type: DEVICE_TYPE.AIR_CONDITIONER, property: 'temperature', value: 24 },
      { device_type: DEVICE_TYPE.CURTAIN, property: 'open_percent', value: 100 },
      { device_type: DEVICE_TYPE.TV, property: 'power', value: false }
    ]
  },
  {
    id: 'SCENE_SLEEP',
    code: SCENE_CODE.SLEEP,
    name: '睡眠模式',
    icon: '🌙',
    description: '全屋熄灯、闭合窗帘、空调 26℃ 静音',
    actions: [
      { device_type: DEVICE_TYPE.LIGHT, property: 'power', value: false },
      { device_type: DEVICE_TYPE.AIR_CONDITIONER, property: 'power', value: true },
      { device_type: DEVICE_TYPE.AIR_CONDITIONER, property: 'temperature', value: 26 },
      { device_type: DEVICE_TYPE.AIR_CONDITIONER, property: 'fan_speed', value: 'low' },
      { device_type: DEVICE_TYPE.CURTAIN, property: 'open_percent', value: 0 },
      { device_type: DEVICE_TYPE.TV, property: 'power', value: false }
    ]
  },
  {
    id: 'SCENE_MOVIE',
    code: SCENE_CODE.MOVIE,
    name: '观影模式',
    icon: '🎬',
    description: '昏暗氛围光、闭合窗帘、电视开启',
    actions: [
      { device_type: DEVICE_TYPE.LIGHT, property: 'power', value: true },
      { device_type: DEVICE_TYPE.LIGHT, property: 'brightness', value: 15 },
      { device_type: DEVICE_TYPE.LIGHT, property: 'color_temp', value: 3000 },
      { device_type: DEVICE_TYPE.CURTAIN, property: 'open_percent', value: 0 },
      { device_type: DEVICE_TYPE.TV, property: 'power', value: true },
      { device_type: DEVICE_TYPE.TV, property: 'volume', value: 35 },
      { device_type: DEVICE_TYPE.AIR_CONDITIONER, property: 'temperature', value: 24 }
    ]
  },
  {
    id: 'SCENE_LEAVE',
    code: SCENE_CODE.LEAVE,
    name: '离店模式',
    icon: '🧳',
    description: '关闭全部设备电源，节能省电',
    actions: [
      { device_type: DEVICE_TYPE.LIGHT, property: 'power', value: false },
      { device_type: DEVICE_TYPE.AIR_CONDITIONER, property: 'power', value: false },
      { device_type: DEVICE_TYPE.CURTAIN, property: 'open_percent', value: 0 },
      { device_type: DEVICE_TYPE.TV, property: 'power', value: false }
    ]
  }
]

// ---------------------------------------------------------------------------
// 告警（设备离线 / SOS）
// ---------------------------------------------------------------------------

export const alarms = [
  {
    id: 'AL1001',
    type: 'offline',
    type_label: ALARM_TYPE_LABEL.offline,
    level: ALARM_LEVEL.HIGH,
    device_id: 'DEV-310-LIGHT',
    device_name: '310 房智能灯光',
    room_id: 'R310',
    room_no: '310',
    status: ALARM_STATUS.PENDING,
    created_at: formatDateTime(Date.now() - 26 * 60 * 1000),
    handled_at: '',
    handler: '',
    content: '设备心跳超时 30 分钟，请检查网络或网关。'
  },
  {
    id: 'AL1002',
    type: 'sos',
    type_label: ALARM_TYPE_LABEL.sos,
    level: ALARM_LEVEL.HIGH,
    device_id: 'DEV-508-TV',
    device_name: '508 房 SOS 呼叫面板',
    room_id: 'R508',
    room_no: '508',
    status: ALARM_STATUS.PENDING,
    created_at: formatDateTime(Date.now() - 3 * HOUR),
    handled_at: '',
    handler: '',
    content: '住客触发紧急呼叫，请前台立即响应。'
  },
  {
    id: 'AL1003',
    type: 'fault',
    type_label: ALARM_TYPE_LABEL.fault,
    level: ALARM_LEVEL.MEDIUM,
    device_id: 'DEV-407-AC',
    device_name: '407 房智能空调',
    room_id: 'R407',
    room_no: '407',
    status: ALARM_STATUS.PENDING,
    created_at: formatDateTime(Date.now() - 8 * HOUR),
    handled_at: '',
    handler: '',
    content: '空调回风温度传感器异常，建议工程上门检修。'
  }
]

// ---------------------------------------------------------------------------
// 能耗（近 30 天）
// ---------------------------------------------------------------------------

const energySeries = []
for (let index = 29; index >= 0; index -= 1) {
  const timestamp = TODAY - index * DAY
  const electricity = randomInt(720, 1180)
  const water = randomInt(38, 76)
  energySeries.push({
    date: formatDate(timestamp),
    week_day: DAY_NAMES[new Date(timestamp).getDay()],
    electricity_kwh: electricity,
    water_m3: water,
    cost: Number((electricity * 0.82 + water * 3.6).toFixed(2))
  })
}

export const energy = {
  series: energySeries,
  totals: {
    electricity_kwh: energySeries.reduce((total, item) => total + item.electricity_kwh, 0),
    water_m3: energySeries.reduce((total, item) => total + item.water_m3, 0),
    cost: Number(energySeries.reduce((total, item) => total + item.cost, 0).toFixed(2))
  }
}

// ---------------------------------------------------------------------------
// 经营看板（近 30 天趋势，静态随机数保证视觉稳定）
// ---------------------------------------------------------------------------

const dashboardSeries = []
for (let index = 29; index >= 0; index -= 1) {
  const timestamp = TODAY - index * DAY
  const date = new Date(timestamp)
  const isWeekend = [0, 6].includes(date.getDay())
  const occupancy = Number((isWeekend ? 0.78 + random() * 0.16 : 0.52 + random() * 0.2).toFixed(4))
  const revenue = Math.round(occupancy * 50 * (390 + randomInt(0, 260)))
  dashboardSeries.push({
    date: formatDate(timestamp),
    week_day: DAY_NAMES[date.getDay()],
    revenue,
    occupancy_rate: occupancy,
    adr: Math.round(390 + random() * 220)
  })
}

// ---------------------------------------------------------------------------
// 升级方案（需求文档 4.3）
// ---------------------------------------------------------------------------

/** 升级方案物料库：按档次定义设备清单 */
export const planCatalog = {
  scopes: PLAN_SCOPE,
  tiers: PLAN_TIER,
  items: {
    basic: [
      { device_type: DEVICE_TYPE.LIGHT, name: '智能灯光套装（2 路）', unit_price: 800, qty_per_room: 1 },
      { device_type: DEVICE_TYPE.CURTAIN, name: '电动窗帘电机', unit_price: 600, qty_per_room: 1 },
      { device_type: 'panel', name: '智能场景面板', unit_price: 300, qty_per_room: 1 }
    ],
    comfort: [
      { device_type: DEVICE_TYPE.LIGHT, name: '智能灯光套装（4 路）', unit_price: 1500, qty_per_room: 1 },
      { device_type: DEVICE_TYPE.CURTAIN, name: '静音电动窗帘电机', unit_price: 900, qty_per_room: 1 },
      { device_type: DEVICE_TYPE.AIR_CONDITIONER, name: '中央空调智控模块', unit_price: 1200, qty_per_room: 1 },
      { device_type: 'panel', name: '智能场景面板', unit_price: 500, qty_per_room: 1 }
    ],
    premium: [
      { device_type: DEVICE_TYPE.LIGHT, name: '全屋智能灯光系统', unit_price: 2600, qty_per_room: 1 },
      { device_type: DEVICE_TYPE.CURTAIN, name: '静音电动窗帘电机', unit_price: 900, qty_per_room: 1 },
      { device_type: DEVICE_TYPE.AIR_CONDITIONER, name: '中央空调智控模块', unit_price: 1200, qty_per_room: 1 },
      { device_type: DEVICE_TYPE.TV, name: '电视语音控制器', unit_price: 800, qty_per_room: 1 },
      { device_type: 'gateway', name: '全屋智能网关', unit_price: 1500, qty_per_room: 1 },
      { device_type: 'sensor', name: '人体感应与SOS套装', unit_price: 700, qty_per_room: 1 }
    ]
  }
}

/**
 * 按「范围 + 档次」生成方案（纯函数，方便复用到真实后端）。
 * @param {string} scope room / floor / store
 * @param {string} tier basic / comfort / premium
 * @returns {Object} 方案草稿
 */
export function buildPlanDraft(scope, tier) {
  const scopeOption = PLAN_SCOPE.find((item) => item.value === scope) || PLAN_SCOPE[0]
  const tierOption = PLAN_TIER.find((item) => item.value === tier) || PLAN_TIER[0]
  const catalogItems = planCatalog.items[tier] || planCatalog.items.basic
  const roomCount = scopeOption.room_count
  const items = catalogItems.map((item) => {
    const qty = item.qty_per_room * roomCount
    return {
      device_type: item.device_type,
      name: item.name,
      qty,
      unit_price: item.unit_price,
      amount: qty * item.unit_price
    }
  })
  return {
    id: `PLAN_${Date.now()}`,
    name: `${tierOption.label} · ${scopeOption.label}`,
    scope,
    scope_label: scopeOption.label,
    scope_value: roomCount,
    tier,
    tier_label: tierOption.label,
    room_count: roomCount,
    items,
    total_price: items.reduce((total, item) => total + item.amount, 0),
    status: PLAN_STATUS.DRAFT,
    creator: '王经理',
    approver: '',
    comment: '',
    created_at: formatDateTime(Date.now())
  }
}

/** @type {Array<Object>} */
export const plans = [
  (() => {
    const draft = buildPlanDraft('floor', 'comfort')
    draft.id = 'PLAN_1001'
    draft.status = PLAN_STATUS.PENDING_APPROVAL
    draft.name = '舒适进阶 · 整层楼（5F）'
    draft.created_at = formatDateTime(TODAY - 2 * DAY + 10 * HOUR)
    draft.comment = '优先改造 5F 亲子房楼层，配合暑期活动。'
    return draft
  })(),
  (() => {
    const draft = buildPlanDraft('room', 'premium')
    draft.id = 'PLAN_1002'
    draft.status = PLAN_STATUS.APPROVED
    draft.name = '旗舰尊享 · 样板房'
    draft.created_at = formatDateTime(TODAY - 6 * DAY + 15 * HOUR)
    draft.approver = '王经理'
    draft.comment = '已按样板房标准落地，可作为对外展示间。'
    return draft
  })(),
  (() => {
    const draft = buildPlanDraft('store', 'basic')
    draft.id = 'PLAN_1003'
    draft.status = PLAN_STATUS.REJECTED
    draft.name = '基础焕新 · 整店'
    draft.created_at = formatDateTime(TODAY - 12 * DAY + 11 * HOUR)
    draft.approver = '王经理'
    draft.comment = '整店改造预算超限，建议先按楼层推进。'
    return draft
  })()
]

// ---------------------------------------------------------------------------
// 财务发票
// ---------------------------------------------------------------------------

const completedOrders = orders.filter((item) => [ORDER_STATUS.COMPLETED, ORDER_STATUS.REVIEWED].includes(item.status))

/** @type {Array<Object>} */
export const invoices = completedOrders.slice(0, 6).map((order, index) => ({
  id: `INV${1001 + index}`,
  order_id: order.id,
  order_no: order.order_no,
  room_no: order.room_no,
  guest_name: order.guest_name,
  amount: order.amount,
  title: index % 2 === 0 ? '个人' : '企业',
  tax_no: index % 2 === 0 ? '' : `91330100MA2${randomInt(100000, 999999)}`,
  status: index < 3 ? 'issued' : 'pending',
  issued_at: index < 3 ? formatDateTime(TODAY - index * DAY + 9 * HOUR) : '',
  created_at: order.created_at
}))

// ---------------------------------------------------------------------------
// 导出统一数据库对象 + 公共操作
// ---------------------------------------------------------------------------

export const db = {
  stores,
  roomTypes,
  rooms,
  users,
  devices,
  scenes,
  orders,
  alarms,
  reviews,
  invoices,
  plans,
  planCatalog,
  energy,
  dashboardSeries
}

/**
 * 按 id 查找房间。
 * @param {string} roomId
 * @returns {Object|undefined}
 */
export function findRoom(roomId) {
  return rooms.find((room) => room.id === roomId)
}

/**
 * 按 id 查找订单。
 * @param {string} orderId
 * @returns {Object|undefined}
 */
export function findOrder(orderId) {
  return orders.find((order) => order.id === orderId || order.order_no === orderId)
}

/**
 * 按手机号查找用户。
 * @param {string} phone
 * @returns {Object|undefined}
 */
export function findUserByPhone(phone) {
  return users.find((user) => user.phone === phone)
}

/**
 * 按 id 查找用户。
 * @param {string} userId
 * @returns {Object|undefined}
 */
export function findUserById(userId) {
  return users.find((user) => user.id === userId)
}

/**
 * 获取某房间全部设备。
 * @param {string} roomId
 * @returns {Array<Object>}
 */
export function getDevicesByRoom(roomId) {
  return devices.filter((device) => device.room_id === roomId)
}

/**
 * 获取顾客当前入住订单（设备控制权来源）。
 * @param {string} userId
 * @returns {Object|undefined}
 */
export function getActiveOrderOfUser(userId) {
  return orders.find((order) => order.user_id === userId && order.status === ORDER_STATUS.CHECKED_IN)
}

/**
 * 修改房态（校验房态机，Mock 内部统一入口）。
 * @param {string} roomId
 * @param {string} nextStatus
 * @returns {Object} 更新后的房间
 */
export function setRoomStatus(roomId, nextStatus) {
  const room = findRoom(roomId)
  if (!room) throw new Error(`[mock] room not found: ${roomId}`)
  room.status = nextStatus
  if (nextStatus === ROOM_STATUS.VACANT_READY || nextStatus === ROOM_STATUS.DIRTY) {
    room.current_order_id = ''
    room.guest_name = ''
    room.guest_phone = ''
    room.check_in_time = ''
    room.check_out_time = ''
  }
  return room
}

/**
 * 对某房间执行场景（批量写入设备属性）。
 * @param {string} roomId
 * @param {Object} scene
 * @returns {Array<Object>} 更新后的设备列表
 */
export function applySceneToRoom(roomId, scene) {
  const roomDevices = getDevicesByRoom(roomId)
  scene.actions.forEach((action) => {
    roomDevices
      .filter((device) => device.type === action.device_type)
      .forEach((device) => {
        device.properties = { ...device.properties, [action.property]: action.value }
        device.last_heartbeat = formatDateTime(Date.now())
      })
  })
  return roomDevices
}

/**
 * 分页工具。
 * @template T
 * @param {T[]} list
 * @param {number} page
 * @param {number} pageSize
 * @returns {{ list: T[], total: number, page: number, page_size: number }}
 */
export function paginate(list, page = 1, pageSize = 10) {
  const current = Math.max(1, Number(page) || 1)
  const size = Math.max(1, Number(pageSize) || 10)
  const start = (current - 1) * size
  return {
    list: list.slice(start, start + size),
    total: list.length,
    page: current,
    page_size: size
  }
}

/**
 * 计算某房间住客展示信息。
 * @param {Object} room
 * @returns {{ status_label: string, order_status: string }}
 */
export function roomViewMeta(room) {
  return {
    status_label: ROOM_STATUS_LABEL[room.status] || room.status,
    order_status: room.current_order_id ? (findOrder(room.current_order_id)?.status || '') : ''
  }
}

/**
 * 重置 Mock 数据（演示用：刷新页面即可恢复初始数据，此处仅导出占位）。
 * @returns {void}
 */
export function resetDb() {
  if (typeof window !== 'undefined' && window.location) {
    window.location.reload()
  }
}

export { todayISO }

/**
 * 今天日期字符串（YYYY-MM-DD）。
 * @returns {string}
 */
function todayISO() {
  return formatDate(TODAY)
}

/** 供 Mock 模块复用的订单状态中文映射 */
export { ORDER_STATUS_LABEL, ROOM_STATUS_LABEL, ORDER_STATUS, ROOM_STATUS }
