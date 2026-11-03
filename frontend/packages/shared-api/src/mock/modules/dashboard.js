/**
 * 经营看板 / 能耗 Mock 接口（需求文档 4.2.1、4.2.3）。
 * 图表数据全部来自 db 中的静态序列，保证视觉稳定、无需真实后端。
 */
import {
  ROOM_STATUS,
  ROOM_STATUS_LABEL,
  ROOM_STATUS_COLOR,
  ORDER_STATUS,
  ALARM_STATUS,
  PLAN_STATUS
} from '@smart-home/utils'
import { db, formatDate } from '../db.js'

/**
 * 统计各房态数量。
 * @returns {Record<string, number>}
 */
function countRoomsByStatus() {
  /** @type {Record<string, number>} */
  const counts = {}
  Object.values(ROOM_STATUS).forEach((status) => {
    counts[status] = db.rooms.filter((room) => room.status === status).length
  })
  return counts
}

/**
 * 求和。
 * @param {Array<Object>} list
 * @param {string} key
 * @returns {number}
 */
function sumBy(list, key) {
  return list.reduce((total, item) => total + (Number(item[key]) || 0), 0)
}

/** @type {Array<Object>} */
export const dashboardMock = [
  {
    method: 'GET',
    path: '/dashboard/overview',
    delay: 360,
    handler: () => {
      const counts = countRoomsByStatus()
      const total = db.rooms.length
      const today = formatDate(Date.now())
      const series = db.dashboardSeries
      const latest = series[series.length - 1] || { revenue: 0, adr: 0 }
      const occupiedOrders = db.orders.filter((order) => order.status === ORDER_STATUS.CHECKED_IN)
      const todayCheckIn = db.orders.filter((order) => String(order.check_in_time).startsWith(today))
      const todayCheckOut = db.orders.filter(
        (order) =>
          String(order.check_out_time).startsWith(today) &&
          [ORDER_STATUS.CHECKED_IN, ORDER_STATUS.COMPLETED, ORDER_STATUS.REVIEWED].includes(order.status)
      )
      const pendingAlarms = db.alarms.filter((alarm) => alarm.status === ALARM_STATUS.PENDING)
      const pendingPlans = db.plans.filter((plan) => plan.status === PLAN_STATUS.PENDING_APPROVAL)
      const ratings = db.reviews.map((review) => review.rating)
      const avgRating = ratings.length ? Number((sumBy(db.reviews, 'rating') / ratings.length).toFixed(2)) : 0

      return {
        date: today,
        room_total: total,
        room_occupied: counts[ROOM_STATUS.OCCUPIED] || 0,
        room_reserved: counts[ROOM_STATUS.RESERVED] || 0,
        room_vacant: counts[ROOM_STATUS.VACANT_READY] || 0,
        room_dirty: counts[ROOM_STATUS.DIRTY] || 0,
        room_maintenance: counts[ROOM_STATUS.MAINTENANCE] || 0,
        occupancy_rate: Number(((counts[ROOM_STATUS.OCCUPIED] || 0) / total).toFixed(4)),
        revenue_today: latest.revenue,
        revenue_month: sumBy(series, 'revenue'),
        adr: latest.adr,
        guest_count: occupiedOrders.length,
        today_check_in: todayCheckIn.length,
        today_check_out: todayCheckOut.length,
        pending_alarms: pendingAlarms.length,
        pending_plans: pendingPlans.length,
        avg_rating: avgRating,
        total_orders: db.orders.length
      }
    }
  },
  {
    method: 'GET',
    path: '/dashboard/trend',
    delay: 380,
    /**
     * 营收 / 入住率 / 客单价趋势。
     * @param {{ query: { days?: string } }} ctx
     */
    handler: ({ query }) => {
      const days = Math.min(30, Math.max(7, Number(query.days) || 30))
      const list = db.dashboardSeries.slice(-days).map((item) => ({
        ...item,
        occupancy_percent: Number((item.occupancy_rate * 100).toFixed(1))
      }))
      return { days, list }
    }
  },
  {
    method: 'GET',
    path: '/dashboard/room-status-distribution',
    delay: 300,
    handler: () => {
      const counts = countRoomsByStatus()
      const total = db.rooms.length || 1
      const list = Object.values(ROOM_STATUS).map((status) => ({
        status,
        label: ROOM_STATUS_LABEL[status],
        color: ROOM_STATUS_COLOR[status],
        count: counts[status] || 0,
        percent: Number((((counts[status] || 0) / total) * 100).toFixed(1))
      }))
      return { list, total: db.rooms.length }
    }
  },
  {
    method: 'GET',
    path: '/energy/summary',
    delay: 380,
    /**
     * 能耗总览（电 / 水 / 费用）。
     * @param {{ query: { days?: string } }} ctx
     */
    handler: ({ query }) => {
      const days = Math.min(30, Math.max(7, Number(query.days) || 30))
      const series = db.energy.series.slice(-days)
      return {
        days,
        series,
        totals: {
          electricity_kwh: sumBy(series, 'electricity_kwh'),
          water_m3: Number(sumBy(series, 'water_m3').toFixed(1)),
          cost: Number(sumBy(series, 'cost').toFixed(2))
        }
      }
    }
  }
]
