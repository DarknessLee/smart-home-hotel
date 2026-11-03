/**
 * 订单相关接口（覆盖需求文档 3.1 状态机全链路）。
 */
import { http } from '../http.js'

export const orderApi = {
  /**
   * 创建订单（初始态：待支付）。
   * @param {Object} data
   * @param {string} data.room_type_id 房型 id
   * @param {string} [data.room_id] 指定房间（可选）
   * @param {string} data.check_in_time 入住日期 YYYY-MM-DD
   * @param {string} data.check_out_time 离店日期 YYYY-MM-DD
   * @param {string} [data.guest_name]
   * @param {string} [data.guest_phone]
   * @param {string} [data.remark]
   * @returns {Promise<Object>}
   */
  createOrder(data) {
    return http.post('/orders', data)
  },
  /**
   * 订单列表。
   * @param {{ self?: 1|0, status?: string, keyword?: string, page?: number, page_size?: number, room_id?: string }} [params]
   * @returns {Promise<{ list: Array<Object>, total: number, page: number, page_size: number }>}
   */
  getOrders(params = {}) {
    return http.get('/orders', { params })
  },
  /**
   * 订单详情。
   * @param {string} id 订单 id 或订单号
   * @returns {Promise<Object>}
   */
  getOrder(id) {
    return http.get(`/orders/${id}`)
  },
  /**
   * 支付订单：待支付 → 已确认（Mock 微信支付回调）。
   * @param {string} id
   * @returns {Promise<Object>}
   */
  payOrder(id) {
    return http.post(`/orders/${id}/pay`)
  },
  /**
   * 取消订单：待支付 → 已取消。
   * @param {string} id
   * @returns {Promise<Object>}
   */
  cancelOrder(id) {
    return http.post(`/orders/${id}/cancel`)
  },
  /**
   * 申请退款：已支付 / 已确认 / 待入住 → 退款中。
   * @param {string} id
   * @param {string} [reason]
   * @returns {Promise<Object>}
   */
  refundOrder(id, reason = '') {
    return http.post(`/orders/${id}/refund`, { reason })
  },
  /**
   * 确认退款：退款中 → 已退款（B 端财务 / 前台）。
   * @param {string} id
   * @returns {Promise<Object>}
   */
  confirmRefund(id) {
    return http.post(`/orders/${id}/refund/confirm`)
  },
  /**
   * 办理入住：已确认 / 待入住 → 已入住（激活设备控制权）。
   * @param {string} id
   * @returns {Promise<Object>}
   */
  checkIn(id) {
    return http.post(`/orders/${id}/check-in`)
  },
  /**
   * 办理退房：已入住 → 已完成（房间转脏房）。
   * @param {string} id
   * @returns {Promise<Object>}
   */
  checkOut(id) {
    return http.post(`/orders/${id}/check-out`)
  },
  /**
   * 评价订单：已完成 → 已评价。
   * @param {string} id
   * @param {{ rating: number, content?: string }} data
   * @returns {Promise<Object>}
   */
  reviewOrder(id, data) {
    return http.post(`/orders/${id}/review`, data)
  },
  /**
   * 订单状态时间轴。
   * @param {string} id
   * @returns {Promise<Array<Object>>}
   */
  getOrderTimeline(id) {
    return http.get(`/orders/${id}/timeline`)
  }
}
