/**
 * 场景 Mock 接口（需求文档 4.1.3：场景一键切换）。
 * 场景执行 = 批量写入设备属性，是「入住 / 睡眠 / 观影 / 离店」的 Mock 实现。
 */
import { MockError, currentUser, enrichDevice, requireRoom } from '../helpers.js'
import { applySceneToRoom, db } from '../db.js'

/** @type {Array<Object>} */
export const sceneMock = [
  {
    method: 'GET',
    path: '/scenes',
    delay: 180,
    handler: () => db.scenes
  },
  {
    method: 'POST',
    path: '/scenes/:id/execute',
    delay: 650,
    /**
     * 执行场景：按 actions 批量更新房间内同类设备属性。
     * @param {{ params: { id: string }, body: { room_id?: string }, headers: Object }} ctx
     */
    handler: ({ params, body, headers }) => {
      const scene = db.scenes.find((item) => item.id === params.id || item.code === params.id)
      if (!scene) throw new MockError(404, '场景不存在')
      const roomId = String(body.room_id || '')
      if (!roomId) throw new MockError(6001, '缺少 room_id')
      const room = requireRoom(roomId)

      // 顾客仅能对当前入住房间执行场景
      const user = currentUser(headers)
      if (user && user.role === 'customer' && user.current_room_id !== room.id) {
        throw new MockError(4031, '仅可控制当前入住房间设备')
      }

      const devices = applySceneToRoom(room.id, scene).map((device) => enrichDevice(device))
      return {
        scene,
        room_id: room.id,
        devices,
        executed_at: new Date().toISOString()
      }
    }
  }
]
