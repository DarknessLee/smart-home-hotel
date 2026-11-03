/**
 * 设备相关接口。
 */
import { http } from '../http.js'

export const deviceApi = {
  /**
   * 设备列表。
   * - 传 room_id 时返回该房间设备数组（C 端控制面板）；
   * - 不传时返回分页对象（B 端设备运维列表）。
   * @param {{ room_id?: string, type?: string, online_status?: string, keyword?: string, page?: number, page_size?: number }} [params]
   * @returns {Promise<Array<Object>|{ list: Array<Object>, total: number, page: number, page_size: number }>}
   */
  getDevices(params = {}) {
    return http.get('/devices', { params })
  },
  /**
   * 设备详情。
   * @param {string} id
   * @returns {Promise<Object>}
   */
  getDevice(id) {
    return http.get(`/devices/${id}`)
  },
  /**
   * 下发设备属性（开关、亮度、温度、开合度等）。
   * @param {string} id
   * @param {Record<string, *>} properties
   * @returns {Promise<Object>}
   */
  updateProperties(id, properties) {
    return http.patch(`/devices/${id}/properties`, properties)
  },
  /**
   * 设备自检。
   * @param {string} id
   * @returns {Promise<Object>}
   */
  checkDevice(id) {
    return http.post(`/devices/${id}/check`)
  },
  /**
   * 重新绑定设备（离线设备恢复上线）。
   * @param {string} id
   * @returns {Promise<Object>}
   */
  rebindDevice(id) {
    return http.post(`/devices/${id}/rebind`)
  }
}
