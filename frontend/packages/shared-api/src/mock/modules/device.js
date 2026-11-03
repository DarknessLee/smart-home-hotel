/**
 * 设备 Mock 接口（需求文档 4.1.3 智能家居控制面板、4.2.3 设备运维）。
 * 属性写入是唯一的设备状态变更入口，前端 Pinia 通过它同步 UI。
 */
import { DEVICE_PROPERTY_SCHEMA, DEVICE_ONLINE_STATUS, DEVICE_TYPE_LABEL } from '@smart-home/utils'
import { MockError, currentUser, enrichDevice, requireRoom } from '../helpers.js'
import { db, formatDateTime, getDevicesByRoom } from '../db.js'

/**
 * 校验属性和值是否合法。
 * @param {Object} device
 * @param {Record<string, *>} patch
 * @returns {void}
 */
function validateProperties(device, patch) {
  const schema = DEVICE_PROPERTY_SCHEMA[device.type]
  if (!schema) throw new MockError(5001, `不支持的设备类型：${device.type}`)
  const allowedKeys = schema.map((item) => item.key)
  Object.keys(patch).forEach((key) => {
    if (!allowedKeys.includes(key)) {
      throw new MockError(5002, `${DEVICE_TYPE_LABEL[device.type]}不支持属性 ${key}`)
    }
  })
}

/** @type {Array<Object>} */
export const deviceMock = [
  {
    method: 'GET',
    path: '/devices',
    delay: 260,
    /**
     * 设备列表：
     * - 传 room_id 时返回该房间设备数组（C 端控制面板）；
     * - 不传时返回分页对象（B 端设备运维列表）。
     * @param {{ query: Object }} ctx
     */
    handler: ({ query }) => {
      if (query.room_id) {
        requireRoom(query.room_id)
        return getDevicesByRoom(query.room_id).map((device) => enrichDevice(device))
      }
      let list = db.devices.slice()
      if (query.type) list = list.filter((device) => device.type === query.type)
      if (query.online_status) list = list.filter((device) => device.online_status === query.online_status)
      if (query.room_id) list = list.filter((device) => device.room_id === query.room_id)
      if (query.keyword) {
        const keyword = String(query.keyword).trim().toLowerCase()
        list = list.filter((device) =>
          [device.room_no, device.sn, device.name].join(' ').toLowerCase().includes(keyword)
        )
      }
      const page = Math.max(1, Number(query.page) || 1)
      const pageSize = Math.max(1, Number(query.page_size) || 20)
      const total = list.length
      const start = (page - 1) * pageSize
      return {
        list: list.slice(start, start + pageSize).map((device) => enrichDevice(device)),
        total,
        page,
        page_size: pageSize
      }
    }
  },
  {
    method: 'GET',
    path: '/devices/:id',
    delay: 180,
    handler: ({ params }) => {
      const device = db.devices.find((item) => item.id === params.id)
      if (!device) throw new MockError(404, '设备不存在')
      return enrichDevice(device)
    }
  },
  {
    method: 'PATCH',
    path: '/devices/:id/properties',
    delay: 160,
    /**
     * 下发设备属性（开关、亮度、温度、开合度等）。
     * 离线设备下发直接失败，用于告警中心演示。
     * @param {{ params: { id: string }, body: Record<string, *>, headers: Object }} ctx
     */
    handler: ({ params, body, headers }) => {
      const device = db.devices.find((item) => item.id === params.id)
      if (!device) throw new MockError(404, '设备不存在')

      // 顾客只能控制自己当前入住房间的设备（UI 权限控制的兜底）
      const user = currentUser(headers)
      if (user && user.role === 'customer') {
        if (user.current_room_id !== device.room_id) {
          throw new MockError(4031, '仅可控制当前入住房间设备')
        }
      }

      if (device.online_status === DEVICE_ONLINE_STATUS.OFFLINE) {
        throw new MockError(5003, '设备离线，指令下发失败')
      }

      const patch = body && typeof body === 'object' ? body : {}
      validateProperties(device, patch)
      if (Object.keys(patch).length === 0) throw new MockError(5004, '缺少要下发的设备属性')

      device.properties = { ...device.properties, ...patch }
      device.last_heartbeat = formatDateTime(Date.now())
      // 模拟设备状态回读
      return enrichDevice(device)
    }
  },
  {
    method: 'POST',
    path: '/devices/:id/check',
    delay: 900,
    /** 设备自检（演示运维动作） */
    handler: ({ params }) => {
      const device = db.devices.find((item) => item.id === params.id)
      if (!device) throw new MockError(404, '设备不存在')
      device.last_heartbeat = formatDateTime(Date.now())
      if (device.online_status === DEVICE_ONLINE_STATUS.OFFLINE) {
        throw new MockError(5005, '设备无响应，请联系工程现场排查')
      }
      return { ok: true, device: enrichDevice(device), duration: 1.2 }
    }
  },
  {
    method: 'POST',
    path: '/devices/:id/rebind',
    delay: 600,
    /** 重新绑定（Mock：离线设备重新上线，同时关闭对应离线告警） */
    handler: ({ params }) => {
      const device = db.devices.find((item) => item.id === params.id)
      if (!device) throw new MockError(404, '设备不存在')
      device.online_status = DEVICE_ONLINE_STATUS.ONLINE
      device.last_heartbeat = formatDateTime(Date.now())
      return enrichDevice(device)
    }
  }
]
