/**
 * 订单 Mock 接口：覆盖需求文档 3.1 订单状态机全链路。
 * 所有状态流转都通过 shared-utils 的 ORDER_TRANSITIONS 校验，避免页面硬编码。
 */
import { ORDER_STATUS, ROOM_STATUS, canOrderTransition } from '@smart-home/utils'
import { MockError, enrichOrder, requireRoom, requireUser } from '../helpers.js'
import { db, findOrder, findUserById, formatDateTime } from '../db.js'

const DAY = 24 * 60 * 60 * 1000

/**
 * 生成订单号与 id。
 * @returns {{ id: string, order_no: string }}
 */
function nextOrderIdentity() {
  const now = new Date()
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate()
  ).padStart(2, '0')}`
  const seq = String(db.orders.length + 1).padStart(3, '0')
  return {
    id: `ORD_${Date.now()}`,
    order_no: `ORD${datePart}${seq}`
  }
}

/**
 * 组装带 14:00 / 12:00 的入住离店时间。
 * @param {string} dateStr YYYY-MM-DD
 * @param {number} hour
 * @param {number} minute
 * @returns {Date}
 */
function atTime(dateStr, hour, minute) {
  const parts = String(dateStr || '').split('-').map(Number)
  if (parts.length !== 3 || parts.some((item) => Number.isNaN(item))) {
    throw new MockError(4001, '日期格式应为 YYYY-MM-DD')
  }
  return new Date(parts[0], parts[1] - 1, parts[2], hour, minute)
}

/**
 * 校验并返回可流转的订单。
 * @param {string} orderId
 * @param {string} toStatus
 * @param {Object} [user]
 * @returns {Object}
 */
function transitionOrder(orderId, toStatus, user) {
  const order = findOrder(orderId)
  if (!order) throw new MockError(404, '订单不存在')
  if (user && user.role === 'customer' && order.user_id !== user.id) {
    throw new MockError(403, '无权操作该订单')
  }
  if (!canOrderTransition(order.status, toStatus)) {
    throw new MockError(4002, `订单状态不允许该操作：${order.status} → ${toStatus}`)
  }
  order.status = toStatus
  return order
}

/**
 * 订单绑定房间状态（办理入住 / 退房）。
 * @param {Object} order
 * @param {string} roomStatus
 * @param {string} userId
 */
function syncRoomByOrder(order, roomStatus, userId) {
  const room = requireRoom(order.room_id)
  room.status = roomStatus
  if (roomStatus === ROOM_STATUS.VACANT_READY || roomStatus === ROOM_STATUS.DIRTY) {
    room.current_order_id = ''
    room.guest_name = ''
    room.guest_phone = ''
    room.check_in_time = ''
    room.check_out_time = ''
  } else {
    room.current_order_id = order.id
    room.guest_name = order.guest_name
    room.guest_phone = order.guest_phone
    room.check_in_time = order.check_in_time
    room.check_out_time = order.check_out_time
  }
  const user = findUserById(userId)
  if (user) {
    if (roomStatus === ROOM_STATUS.OCCUPIED) user.current_room_id = room.id
    if ([ROOM_STATUS.VACANT_READY, ROOM_STATUS.DIRTY].includes(roomStatus) && user.current_room_id === room.id) {
      user.current_room_id = ''
    }
  }
}

/** @type {Array<Object>} */
export const orderMock = [
  {
    method: 'POST',
    path: '/orders',
    delay: 520,
    /**
     * 创建订单（初始态：待支付，对应房态：已预订）。
     * @param {{ body: Object, headers: Object }} ctx
     */
    handler: ({ body, headers }) => {
      const user = requireUser(headers)
      const roomTypeId = String(body.room_type_id || '')
      const roomType = db.roomTypes.find((type) => type.id === roomTypeId)
      let room = null
      if (body.room_id) {
        room = requireRoom(body.room_id)
        if (room.status !== ROOM_STATUS.VACANT_READY) throw new MockError(4004, '该房间当前不可预订')
      } else {
        if (!roomType) throw new MockError(4005, '请选择房型')
        room = db.rooms.find((item) => item.room_type_id === roomTypeId && item.status === ROOM_STATUS.VACANT_READY)
        if (!room) throw new MockError(4006, '该房型暂无可售房间，请更换日期或房型')
      }

      const checkInDate = String(body.check_in_time || '').slice(0, 10)
      const checkOutDate = String(body.check_out_time || '').slice(0, 10)
      const checkIn = atTime(checkInDate, 14, 0)
      const checkOut = atTime(checkOutDate, 12, 0)
      const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / DAY)
      if (nights < 1) throw new MockError(4007, '离店日期需晚于入住日期')

      const identity = nextOrderIdentity()
      const order = {
        ...identity,
        user_id: user.id,
        room_id: room.id,
        room_no: room.room_no,
        room_type_id: room.room_type_id,
        type_name: room.type_name,
        price: room.price,
        nights,
        amount: room.price * nights,
        status: ORDER_STATUS.PENDING_PAYMENT,
        check_in_time: formatDateTime(checkIn),
        check_out_time: formatDateTime(checkOut),
        guest_name: String(body.guest_name || user.real_name || '散客'),
        guest_phone: String(body.guest_phone || user.phone || ''),
        remark: String(body.remark || ''),
        created_at: formatDateTime(Date.now()),
        paid_at: '',
        checked_in_at: '',
        checked_out_at: '',
        cancelled_at: '',
        refund_reason: '',
        source: 'c_app',
        review_id: ''
      }
      db.orders.push(order)

      // 下单即占房：已预订（待支付超时释放属于后期业务，Mock 阶段简化）
      room.status = ROOM_STATUS.RESERVED
      room.current_order_id = order.id
      room.guest_name = order.guest_name
      room.guest_phone = order.guest_phone
      room.check_in_time = order.check_in_time
      room.check_out_time = order.check_out_time

      return enrichOrder(order)
    }
  },
  {
    method: 'GET',
    path: '/orders',
    delay: 280,
    /**
     * 订单列表（B 端全量 / C 端 self=1 只看自己）。
     * @param {{ query: Object, headers: Object }} ctx
     */
    handler: ({ query, headers }) => {
      let list = db.orders.slice()
      // 兼容 number / string 两种传参（Pinia store 会原样透传 self: 1）
      const selfOnly = String(query.self ?? '')
      if (selfOnly === '1' || selfOnly === 'true') {
        const user = requireUser(headers)
        list = list.filter((order) => order.user_id === user.id)
      }
      if (query.status) list = list.filter((order) => order.status === query.status)
      if (query.room_id) list = list.filter((order) => order.room_id === query.room_id)
      if (query.keyword) {
        const keyword = String(query.keyword).trim().toLowerCase()
        list = list.filter((order) =>
          [order.order_no, order.room_no, order.guest_name, order.guest_phone]
            .join(' ')
            .toLowerCase()
            .includes(keyword)
        )
      }
      list.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      const page = Math.max(1, Number(query.page) || 1)
      const pageSize = Math.max(1, Number(query.page_size) || (query.page ? 10 : list.length))
      const start = (page - 1) * pageSize
      const pageList = list.slice(start, start + pageSize).map((order) => enrichOrder(order))
      return {
        list: pageList,
        total: list.length,
        page,
        page_size: pageSize
      }
    }
  },
  {
    method: 'GET',
    path: '/orders/:id',
    delay: 200,
    handler: ({ params }) => {
      const order = findOrder(params.id)
      if (!order) throw new MockError(404, '订单不存在')
      return enrichOrder(order)
    }
  },
  {
    method: 'POST',
    path: '/orders/:id/pay',
    delay: 800,
    /**
     * 支付回调（Mock 微信支付）：待支付 → 已支付 → 已确认。
     * @param {{ params: { id: string }, headers: Object }} ctx
     */
    handler: ({ params, headers }) => {
      const user = requireUser(headers)
      const order = findOrder(params.id)
      if (!order) throw new MockError(404, '订单不存在')
      if (user.role === 'customer' && order.user_id !== user.id) throw new MockError(403, '无权操作该订单')
      if (!canOrderTransition(order.status, ORDER_STATUS.PAID)) {
        throw new MockError(4002, '当前订单状态不可支付')
      }
      order.status = ORDER_STATUS.PAID
      order.paid_at = formatDateTime(Date.now())
      // 支付成功后自动确认（Mock 阶段跳过人工审核）
      order.status = ORDER_STATUS.CONFIRMED
      syncRoomByOrder(order, ROOM_STATUS.RESERVED, order.user_id)
      return enrichOrder(order)
    }
  },
  {
    method: 'POST',
    path: '/orders/:id/cancel',
    delay: 360,
    handler: ({ params, headers }) => {
      const user = requireUser(headers)
      const order = transitionOrder(params.id, ORDER_STATUS.CANCELLED, user)
      order.cancelled_at = formatDateTime(Date.now())
      syncRoomByOrder(order, ROOM_STATUS.VACANT_READY, order.user_id)
      return enrichOrder(order)
    }
  },
  {
    method: 'POST',
    path: '/orders/:id/refund',
    delay: 520,
    handler: ({ params, body, headers }) => {
      const user = requireUser(headers)
      const order = transitionOrder(params.id, ORDER_STATUS.REFUNDING, user)
      order.refund_reason = String(body.reason || '顾客申请退款')
      return enrichOrder(order)
    }
  },
  {
    method: 'POST',
    path: '/orders/:id/refund/confirm',
    delay: 420,
    handler: ({ params }) => {
      const order = transitionOrder(params.id, ORDER_STATUS.REFUNDED)
      order.refund_at = formatDateTime(Date.now())
      syncRoomByOrder(order, ROOM_STATUS.VACANT_READY, order.user_id)
      return enrichOrder(order)
    }
  },
  {
    method: 'POST',
    path: '/orders/:id/check-in',
    delay: 480,
    /**
     * 办理入住：待入住 / 已确认 → 已入住，同时激活该房间设备控制权。
     * 顾客自助入住需已完成实名认证。
     * @param {{ params: { id: string }, headers: Object }} ctx
     */
    handler: ({ params, headers }) => {
      const user = requireUser(headers)
      const order = findOrder(params.id)
      if (!order) throw new MockError(404, '订单不存在')
      const isSelf = order.user_id === user.id
      if (isSelf && user.role === 'customer' && user.status !== 'normal') {
        throw new MockError(4003, '请先完成实名认证后再办理入住')
      }
      const allowed = [ORDER_STATUS.CONFIRMED, ORDER_STATUS.AWAITING_CHECKIN, ORDER_STATUS.PAID]
      if (!allowed.includes(order.status)) throw new MockError(4002, '当前订单状态不可办理入住')
      order.status = ORDER_STATUS.CHECKED_IN
      order.checked_in_at = formatDateTime(Date.now())
      syncRoomByOrder(order, ROOM_STATUS.OCCUPIED, order.user_id)
      return enrichOrder(order)
    }
  },
  {
    method: 'POST',
    path: '/orders/:id/check-out',
    delay: 480,
    /**
     * 办理退房：已入住 → 已完成，房间转为脏房并回收设备控制权。
     * @param {{ params: { id: string } }} ctx
     */
    handler: ({ params }) => {
      const order = transitionOrder(params.id, ORDER_STATUS.COMPLETED)
      order.checked_out_at = formatDateTime(Date.now())
      syncRoomByOrder(order, ROOM_STATUS.DIRTY, order.user_id)
      return enrichOrder(order)
    }
  },
  {
    method: 'POST',
    path: '/orders/:id/review',
    delay: 320,
    /**
     * 评价：已完成 → 已评价。
     * @param {{ params: { id: string }, body: { rating?: number, content?: string }, headers: Object }} ctx
     */
    handler: ({ params, body, headers }) => {
      const user = requireUser(headers)
      const order = transitionOrder(params.id, ORDER_STATUS.REVIEWED, user)
      const rating = Math.min(5, Math.max(1, Number(body.rating) || 5))
      const review = {
        id: `RV${Date.now()}`,
        order_id: order.id,
        order_no: order.order_no,
        room_id: order.room_id,
        room_no: order.room_no,
        user_id: user.id,
        user_name: user.real_name || order.guest_name,
        rating,
        content: String(body.content || ''),
        created_at: formatDateTime(Date.now())
      }
      db.reviews.unshift(review)
      order.review_id = review.id
      return { ...enrichOrder(order), review }
    }
  },
  {
    method: 'GET',
    path: '/orders/:id/timeline',
    delay: 160,
    /**
     * 订单状态时间轴（C 端订单详情展示）。
     * @param {{ params: { id: string } }} ctx
     */
    handler: ({ params }) => {
      const order = findOrder(params.id)
      if (!order) throw new MockError(404, '订单不存在')
      const steps = [
        { status: ORDER_STATUS.PENDING_PAYMENT, label: '提交订单', time: order.created_at },
        { status: ORDER_STATUS.PAID, label: '支付成功', time: order.paid_at },
        { status: ORDER_STATUS.CHECKED_IN, label: '办理入住', time: order.checked_in_at },
        { status: ORDER_STATUS.COMPLETED, label: '退房完成', time: order.checked_out_at },
        { status: ORDER_STATUS.REVIEWED, label: '已评价', time: order.review_id ? order.checked_out_at : '' }
      ]
      return steps.map((step) => ({ ...step }))
    }
  }
]
