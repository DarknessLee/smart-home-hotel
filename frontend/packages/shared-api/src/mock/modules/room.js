/**
 * 客房 / 房态 Mock 接口（需求文档 4.1.2 房态查询、4.2.2 房态图与前台操作）。
 */
import { ROOM_STATUS, ROOM_STATUS_LABEL, ROOM_STATUS_COLOR, canRoomTransition } from '@smart-home/utils'
import { MockError, enrichDevice, enrichRoom, requireRoom } from '../helpers.js'
import { db, formatDateTime, getDevicesByRoom, setRoomStatus } from '../db.js'

/**
 * 房间关键字过滤。
 * @param {Object} room
 * @param {string} keyword
 * @returns {boolean}
 */
function matchKeyword(room, keyword) {
  if (!keyword) return true
  const text = String(keyword).trim().toLowerCase()
  return [room.room_no, room.type_name, room.guest_name].join(' ').toLowerCase().includes(text)
}

/** @type {Array<Object>} */
export const roomMock = [
  {
    method: 'GET',
    path: '/stores',
    handler: () => db.stores
  },
  {
    method: 'GET',
    path: '/room-types',
    delay: 200,
    handler: ({ query }) => {
      const storeId = query.store_id
      const types = storeId ? db.roomTypes.filter((item) => item.store_id === storeId) : db.roomTypes
      return types
    }
  },
  {
    method: 'GET',
    path: '/rooms/availability',
    delay: 320,
    /**
     * 房型可售查询（Mock 阶段按当前房态统计，日期仅回显不参与计算）。
     * @param {{ query: Object }} ctx
     */
    handler: ({ query }) => {
      const list = db.roomTypes.map((type) => {
        const rooms = db.rooms.filter((room) => room.room_type_id === type.id)
        const available = rooms.filter((room) => room.status === ROOM_STATUS.VACANT_READY)
        return {
          ...type,
          available_count: available.length,
          available_rooms: available.map((room) => room.room_no),
          price: type.price
        }
      })
      return {
        check_in_time: query.check_in_time || '',
        check_out_time: query.check_out_time || '',
        list
      }
    }
  },
  {
    method: 'GET',
    path: '/rooms',
    delay: 260,
    /**
     * 房态列表（B 端房态图 / C 端选房共用）。
     * @param {{ query: Object }} ctx
     */
    handler: ({ query }) => {
      const storeId = query.store_id || 'ST001'
      let list = db.rooms.filter((room) => room.store_id === storeId)
      if (query.status) list = list.filter((room) => room.status === query.status)
      if (query.floor) list = list.filter((room) => String(room.floor) === String(query.floor))
      if (query.room_type_id) list = list.filter((room) => room.room_type_id === query.room_type_id)
      if (query.keyword) list = list.filter((room) => matchKeyword(room, query.keyword))
      list = list
        .slice()
        .sort((a, b) => a.room_no.localeCompare(b.room_no))
        .map((room) => enrichRoom(room))
      return {
        list,
        total: list.length,
        status_legend: Object.keys(ROOM_STATUS).map((key) => ({
          status: ROOM_STATUS[key],
          label: ROOM_STATUS_LABEL[ROOM_STATUS[key]],
          color: ROOM_STATUS_COLOR[ROOM_STATUS[key]]
        }))
      }
    }
  },
  {
    method: 'GET',
    path: '/rooms/:id',
    delay: 220,
    handler: ({ params }) => {
      const room = requireRoom(params.id)
      const devices = getDevicesByRoom(room.id).map((device) => enrichDevice(device))
      return { ...enrichRoom(room), devices }
    }
  },
  {
    method: 'PATCH',
    path: '/rooms/:id/status',
    delay: 320,
    /**
     * 前台修改房态：办理入住 / 退房后的房态变更。
     * @param {{ params: { id: string }, body: { status?: string } }} ctx
     */
    handler: ({ params, body }) => {
      const room = requireRoom(params.id)
      const nextStatus = String(body.status || '')
      if (!Object.values(ROOM_STATUS).includes(nextStatus)) throw new MockError(2001, '未知房态')
      if (nextStatus === room.status) return enrichRoom(room)
      if (!canRoomTransition(room.status, nextStatus)) {
        throw new MockError(
          2002,
          `房态流转不合法：${ROOM_STATUS_LABEL[room.status]} → ${ROOM_STATUS_LABEL[nextStatus]}`
        )
      }
      return enrichRoom(setRoomStatus(room.id, nextStatus))
    }
  },
  {
    method: 'POST',
    path: '/rooms/:id/clean',
    delay: 400,
    /** 保洁完成：脏房 / 维修 → 可售 */
    handler: ({ params }) => {
      const room = requireRoom(params.id)
      if (![ROOM_STATUS.DIRTY, ROOM_STATUS.MAINTENANCE].includes(room.status)) {
        throw new MockError(2003, '当前房态无需保洁')
      }
      return enrichRoom(setRoomStatus(room.id, ROOM_STATUS.VACANT_READY))
    }
  },
  {
    method: 'POST',
    path: '/rooms/:id/maintenance',
    delay: 300,
    /** 标记维修（可售 → 维修中） */
    handler: ({ params }) => {
      const room = requireRoom(params.id)
      if (!canRoomTransition(room.status, ROOM_STATUS.MAINTENANCE)) {
        throw new MockError(2004, `当前房态 ${ROOM_STATUS_LABEL[room.status]} 不能直接转入维修`)
      }
      return enrichRoom(setRoomStatus(room.id, ROOM_STATUS.MAINTENANCE))
    }
  },
  {
    method: 'GET',
    path: '/rooms/:id/devices',
    handler: ({ params }) => {
      const room = requireRoom(params.id)
      return getDevicesByRoom(room.id).map((device) => enrichDevice(device))
    }
  },
  {
    method: 'POST',
    path: '/devices/refresh',
    delay: 150,
    /** 房间设备心跳刷新（演示按钮） */
    handler: () => {
      const count = db.devices.length
      db.devices.forEach((device) => {
        device.last_heartbeat = formatDateTime(Date.now())
      })
      return { refreshed: count }
    }
  }
]
