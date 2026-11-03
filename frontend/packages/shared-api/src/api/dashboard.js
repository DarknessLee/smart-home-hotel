/**
 * 经营看板 / 能耗接口。
 */
import { http } from '../http.js'

export const dashboardApi = {
  /**
   * 核心指标（营收 / 入住率 / 客单价 / 房态数量 / 待处理告警）。
   * @returns {Promise<Object>}
   */
  getOverview() {
    return http.get('/dashboard/overview')
  },
  /**
   * 营收 / 入住率 / 客单价趋势。
   * @param {{ days?: number }} [params]
   * @returns {Promise<{ days: number, list: Array<Object> }>}
   */
  getTrend(params = {}) {
    return http.get('/dashboard/trend', { params })
  },
  /**
   * 房态分布（饼图）。
   * @returns {Promise<{ list: Array<Object>, total: number }>}
   */
  getRoomStatusDistribution() {
    return http.get('/dashboard/room-status-distribution')
  },
  /**
   * 能耗统计（电 / 水 / 费用）。
   * @param {{ days?: number }} [params]
   * @returns {Promise<{ days: number, series: Array<Object>, totals: Object }>}
   */
  getEnergySummary(params = {}) {
    return http.get('/energy/summary', { params })
  }
}
