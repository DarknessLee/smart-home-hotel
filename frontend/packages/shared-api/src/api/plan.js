/**
 * 住宿升级方案接口。
 */
import { http } from '../http.js'

export const planApi = {
  /**
   * 方案物料库（范围 / 档次 / 设备清单规则）。
   * @returns {Promise<Object>}
   */
  getCatalog() {
    return http.get('/plans/catalog')
  },
  /**
   * 方案列表。
   * @returns {Promise<{ list: Array<Object>, total: number }>}
   */
  getPlans() {
    return http.get('/plans')
  },
  /**
   * 方案详情。
   * @param {string} id
   * @returns {Promise<Object>}
   */
  getPlan(id) {
    return http.get(`/plans/${id}`)
  },
  /**
   * 生成方案（范围 + 档次 → 设备清单 + 预算）。
   * @param {{ scope: 'room'|'floor'|'store', tier: 'basic'|'comfort'|'premium' }} data
   * @returns {Promise<Object>}
   */
  generatePlan(data) {
    return http.post('/plans/generate', data)
  },
  /**
   * 提交审批：草稿 → 待审批。
   * @param {string} id
   * @returns {Promise<Object>}
   */
  submitPlan(id) {
    return http.post(`/plans/${id}/submit`)
  },
  /**
   * 审批方案：待审批 → 已通过 / 已驳回（店长权限）。
   * @param {string} id
   * @param {{ approved: boolean, comment?: string }} data
   * @returns {Promise<Object>}
   */
  approvePlan(id, data) {
    return http.post(`/plans/${id}/approve`, data)
  }
}
