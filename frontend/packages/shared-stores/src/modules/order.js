/**
 * 订单状态机状态管理。
 *
 * 所有订单操作（支付 / 取消 / 退款 / 入住 / 退房 / 评价）统一走 actions，
 * 页面只根据 `availableActions` 渲染按钮，状态流转规则由 shared-utils 单点维护。
 */
import { defineStore } from 'pinia'
import { orderApi } from '@smart-home/api'
import {
  ORDER_STATUS_LABEL,
  canControlDevices,
  getOrderActions,
  getOrderAction
} from '@smart-home/utils'
import { useAuthStore } from './auth.js'

export const useOrderStore = defineStore('order', {
  state: () => ({
    list: [],
    total: 0,
    page: 1,
    pageSize: 10,
    current: null,
    timeline: [],
    loading: false,
    submitting: false
  }),

  getters: {
    /**
     * 当前订单可执行操作（按当前登录端过滤）。
     * @returns {Array<{ action: string, label: string, to: string, type: string, confirm: boolean }>}
     */
    availableActions(state) {
      if (!state.current) return []
      const auth = useAuthStore()
      return getOrderActions(state.current.status, auth.isStaff ? 'staff' : 'customer')
    },
    /** 当前订单状态文案 */
    currentStatusLabel: (state) => {
      if (!state.current) return ''
      return ORDER_STATUS_LABEL[state.current.status] || state.current.status
    },
    /** 当前订单是否可控制房间设备 */
    canControlCurrentRoom: (state) => (state.current ? canControlDevices(state.current.status) : false),
    /** 进行中的订单 */
    activeOrders: (state) =>
      state.list.filter((order) =>
        ['pending_payment', 'paid', 'confirmed', 'awaiting_checkin', 'checked_in'].includes(order.status)
      )
  },

  actions: {
    /**
     * 合并订单到列表与当前订单。
     * @param {Object} order
     */
    applyOrder(order) {
      if (!order) return
      const index = this.list.findIndex((item) => item.id === order.id || item.order_no === order.order_no)
      if (index >= 0) this.list[index] = { ...this.list[index], ...order }
      if (!this.current || this.current.id === order.id || this.current.order_no === order.order_no) {
        this.current = { ...(this.current || {}), ...order }
      }
    },

    /**
     * 加载订单列表。
     * @param {{ self?: 1|0, status?: string, keyword?: string, page?: number, page_size?: number }} [params]
     */
    async fetchOrders(params = {}) {
      this.loading = true
      try {
        const data = await orderApi.getOrders({
          page: params.page || this.page,
          page_size: params.page_size || this.pageSize,
          ...params
        })
        this.list = data.list || []
        this.total = data.total || 0
        this.page = data.page || 1
        this.pageSize = data.page_size || this.pageSize
        return data
      } finally {
        this.loading = false
      }
    },

    /**
     * 加载订单详情。
     * @param {string} id
     */
    async fetchOrder(id) {
      this.loading = true
      try {
        this.current = await orderApi.getOrder(id)
        return this.current
      } finally {
        this.loading = false
      }
    },

    /**
     * 加载订单状态时间轴。
     * @param {string} id
     */
    async fetchTimeline(id) {
      this.timeline = await orderApi.getOrderTimeline(id)
      return this.timeline
    },

    /**
     * 创建订单（待支付）。
     * @param {Object} payload
     */
    async createOrder(payload) {
      this.submitting = true
      try {
        const order = await orderApi.createOrder(payload)
        this.current = order
        this.list.unshift(order)
        return order
      } finally {
        this.submitting = false
      }
    },

    /**
     * 支付订单（待支付 → 已确认）。
     * @param {string} id
     */
    async pay(id) {
      this.submitting = true
      try {
        const order = await orderApi.payOrder(id)
        this.applyOrder(order)
        return order
      } finally {
        this.submitting = false
      }
    },

    /**
     * 取消订单（待支付 → 已取消）。
     * @param {string} id
     */
    async cancel(id) {
      this.submitting = true
      try {
        const order = await orderApi.cancelOrder(id)
        this.applyOrder(order)
        return order
      } finally {
        this.submitting = false
      }
    },

    /**
     * 申请退款（已支付 / 已确认 / 待入住 → 退款中）。
     * @param {string} id
     * @param {string} [reason]
     */
    async refund(id, reason = '') {
      this.submitting = true
      try {
        const order = await orderApi.refundOrder(id, reason)
        this.applyOrder(order)
        return order
      } finally {
        this.submitting = false
      }
    },

    /**
     * 确认退款（退款中 → 已退款，B 端）。
     * @param {string} id
     */
    async confirmRefund(id) {
      this.submitting = true
      try {
        const order = await orderApi.confirmRefund(id)
        this.applyOrder(order)
        return order
      } finally {
        this.submitting = false
      }
    },

    /**
     * 办理入住（→ 已入住，激活设备控制权）。
     * @param {string} id
     */
    async checkIn(id) {
      this.submitting = true
      try {
        const order = await orderApi.checkIn(id)
        this.applyOrder(order)
        return order
      } finally {
        this.submitting = false
      }
    },

    /**
     * 办理退房（→ 已完成，房间转脏房）。
     * @param {string} id
     */
    async checkOut(id) {
      this.submitting = true
      try {
        const order = await orderApi.checkOut(id)
        this.applyOrder(order)
        return order
      } finally {
        this.submitting = false
      }
    },

    /**
     * 评价订单（已完成 → 已评价）。
     * @param {string} id
     * @param {{ rating: number, content?: string }} payload
     */
    async review(id, payload) {
      this.submitting = true
      try {
        const order = await orderApi.reviewOrder(id, payload)
        this.applyOrder(order)
        return order
      } finally {
        this.submitting = false
      }
    },

    /**
     * 读取某个操作的定义（按钮文案 / 二次确认）。
     * @param {string} action
     */
    actionMeta(action) {
      return getOrderAction(action)
    }
  }
})
