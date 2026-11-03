/**
 * 经营看板 / 能耗状态（B 端）。
 */
import { defineStore } from 'pinia'
import { dashboardApi } from '@smart-home/api'

export const useDashboardStore = defineStore('dashboard', {
  state: () => ({
    overview: null,
    trend: [],
    trendDays: 30,
    distribution: [],
    distributionTotal: 0,
    energy: { series: [], totals: {} },
    energyDays: 30,
    loading: false
  }),

  getters: {
    /** 入住率百分比 */
    occupancyPercent: (state) =>
      state.overview ? Number((state.overview.occupancy_rate * 100).toFixed(1)) : 0,
    /** 可售房间占比（用于房态饼图） */
    vacantPercent: (state) => {
      if (!state.overview || !state.overview.room_total) return 0
      return Number(((state.overview.room_vacant / state.overview.room_total) * 100).toFixed(1))
    }
  },

  actions: {
    /**
     * 加载核心指标。
     */
    async fetchOverview() {
      this.loading = true
      try {
        this.overview = await dashboardApi.getOverview()
        return this.overview
      } finally {
        this.loading = false
      }
    },

    /**
     * 加载趋势数据。
     * @param {number} [days]
     */
    async fetchTrend(days = 30) {
      this.trendDays = days
      const data = await dashboardApi.getTrend({ days })
      this.trend = data.list || []
      return this.trend
    },

    /**
     * 加载房态分布。
     */
    async fetchDistribution() {
      const data = await dashboardApi.getRoomStatusDistribution()
      this.distribution = data.list || []
      this.distributionTotal = data.total || 0
      return this.distribution
    },

    /**
     * 加载能耗数据。
     * @param {number} [days]
     */
    async fetchEnergy(days = 30) {
      this.energyDays = days
      this.energy = await dashboardApi.getEnergySummary({ days })
      return this.energy
    },

    /**
     * 一次性加载看板全部数据。
     * @param {number} [days]
     */
    async fetchAll(days = 30) {
      await Promise.all([
        this.fetchOverview(),
        this.fetchTrend(days),
        this.fetchDistribution(),
        this.fetchEnergy(days)
      ])
    }
  }
})
