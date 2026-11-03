/**
 * 告警中心接口。
 */
import { http } from '../http.js'

export const alarmApi = {
  /**
   * 告警列表。
   * @param {{ status?: string, type?: string, level?: string }} [params]
   * @returns {Promise<{ list: Array<Object>, total: number, pending: number }>}
   */
  getAlarms(params = {}) {
    return http.get('/alarms', { params })
  },
  /**
   * 处理告警。
   * @param {string} id 告警 id
   * @returns {Promise<Object>}
   */
  handleAlarm(id) {
    return http.post(`/alarms/${id}/handle`)
  }
}
