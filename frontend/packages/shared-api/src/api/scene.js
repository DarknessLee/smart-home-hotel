/**
 * 场景相关接口。
 */
import { http } from '../http.js'

export const sceneApi = {
  /**
   * 预置场景列表（入住 / 睡眠 / 观影 / 离店）。
   * @returns {Promise<Array<Object>>}
   */
  getScenes() {
    return http.get('/scenes')
  },
  /**
   * 执行场景（批量更新房间设备属性）。
   * @param {string} id 场景 id 或 code
   * @param {string} roomId 房间 id
   * @returns {Promise<{ scene: Object, devices: Array<Object>, room_id: string, executed_at: string }>}
   */
  executeScene(id, roomId) {
    return http.post(`/scenes/${id}/execute`, { room_id: roomId })
  }
}
