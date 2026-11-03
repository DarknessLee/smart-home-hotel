/**
 * 告警中心状态（B 端）。
 */
import { defineStore } from 'pinia'
import { alarmApi } from '@smart-home/api'
import { ALARM_STATUS } from '@smart-home/utils'

export const useAlarmStore = defineStore('alarm', {
  state: () => ({
    list: [],
    pending: 0,
    loading: false,
    handlingId: ''
  }),

  getters: {
    /** 待处理告警 */
    pendingList: (state) => state.list.filter((alarm) => alarm.status === ALARM_STATUS.PENDING),
    /** 紧急告警数量 */
    highLevelCount: (state) =>
      state.list.filter((alarm) => alarm.level === 'high' && alarm.status === ALARM_STATUS.PENDING).length
  },

  actions: {
    /**
     * 加载告警列表。
     * @param {{ status?: string, type?: string }} [params]
     */
    async fetchAlarms(params = {}) {
      this.loading = true
      try {
        const data = await alarmApi.getAlarms(params)
        this.list = data.list || []
        this.pending = data.pending || 0
        return data
      } finally {
        this.loading = false
      }
    },

    /**
     * 处理告警。
     * @param {string} id
     */
    async handle(id) {
      this.handlingId = id
      try {
        const alarm = await alarmApi.handleAlarm(id)
        const index = this.list.findIndex((item) => item.id === id)
        if (index >= 0) this.list[index] = { ...this.list[index], ...alarm }
        this.pending = this.list.filter((item) => item.status === ALARM_STATUS.PENDING).length
        return alarm
      } finally {
        this.handlingId = ''
      }
    }
  }
})
