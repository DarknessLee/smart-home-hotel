/**
 * 客房 / 房态相关接口。
 */
import { http } from '../http.js'

export const roomApi = {
  /**
   * 门店列表。
   * @returns {Promise<Array<Object>>}
   */
  getStores() {
    return http.get('/stores')
  },
  /**
   * 房型列表。
   * @param {{ store_id?: string }} [params]
   * @returns {Promise<Array<Object>>}
   */
  getRoomTypes(params = {}) {
    return http.get('/room-types', { params })
  },
  /**
   * 按日期查询房型可售数量。
   * @param {{ check_in_time?: string, check_out_time?: string, store_id?: string }} [params]
   * @returns {Promise<{ list: Array<Object>, check_in_time: string, check_out_time: string }>}
   */
  getAvailability(params = {}) {
    return http.get('/rooms/availability', { params })
  },
  /**
   * 房态列表（B 端房态图 / C 端选房）。
   * @param {{ store_id?: string, status?: string, floor?: number|string, room_type_id?: string, keyword?: string }} [params]
   * @returns {Promise<{ list: Array<Object>, total: number, status_legend: Array<Object> }>}
   */
  getRooms(params = {}) {
    return http.get('/rooms', { params })
  },
  /**
   * 房间详情（含设备列表）。
   * @param {string} id 房间 id
   * @returns {Promise<Object>}
   */
  getRoom(id) {
    return http.get(`/rooms/${id}`)
  },
  /**
   * 修改房态（前台办理入住 / 退房）。
   * @param {string} id 房间 id
   * @param {string} status 目标房态
   * @returns {Promise<Object>}
   */
  updateRoomStatus(id, status) {
    return http.patch(`/rooms/${id}/status`, { status })
  },
  /**
   * 保洁完成：脏房 → 可售。
   * @param {string} id 房间 id
   * @returns {Promise<Object>}
   */
  cleanRoom(id) {
    return http.post(`/rooms/${id}/clean`)
  },
  /**
   * 标记维修。
   * @param {string} id 房间 id
   * @returns {Promise<Object>}
   */
  setMaintenance(id) {
    return http.post(`/rooms/${id}/maintenance`)
  },
  /**
   * 房间设备列表。
   * @param {string} id 房间 id
   * @returns {Promise<Array<Object>>}
   */
  getRoomDevices(id) {
    return http.get(`/rooms/${id}/devices`)
  },
  /**
   * 刷新全量设备心跳（演示按钮）。
   * @returns {Promise<{ refreshed: number }>}
   */
  refreshDevices() {
    return http.post('/devices/refresh')
  }
}
