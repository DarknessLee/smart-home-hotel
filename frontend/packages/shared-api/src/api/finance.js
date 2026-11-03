/**
 * 财务（发票 / 对账）接口。
 */
import { http } from '../http.js'

export const financeApi = {
  /**
   * 发票列表。
   * @param {{ page?: number, page_size?: number, status?: string, keyword?: string }} [params]
   * @returns {Promise<{ list: Array<Object>, total: number, page: number, page_size: number }>}
   */
  getInvoices(params = {}) {
    return http.get('/invoices', { params })
  },
  /**
   * 开具发票。
   * @param {string} id 发票 id
   * @returns {Promise<Object>}
   */
  issueInvoice(id) {
    return http.post(`/invoices/${id}/issue`)
  }
}
