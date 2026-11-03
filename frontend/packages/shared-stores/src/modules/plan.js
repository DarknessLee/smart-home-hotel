/**
 * 住宿升级方案状态（需求文档 4.3 核心特色模块）。
 */
import { defineStore } from 'pinia'
import { planApi } from '@smart-home/api'

export const usePlanStore = defineStore('plan', {
  state: () => ({
    catalog: { scopes: [], tiers: [], items: {} },
    list: [],
    current: null,
    loading: false,
    generating: false,
    approving: false
  }),

  getters: {
    /** 待审批方案 */
    pendingPlans: (state) => state.list.filter((plan) => plan.status === 'pending_approval'),
    /** 已通过方案 */
    approvedPlans: (state) => state.list.filter((plan) => plan.status === 'approved'),
    /** 方案总预算（已通过） */
    approvedBudget: (state) =>
      state.list
        .filter((plan) => plan.status === 'approved')
        .reduce((total, plan) => total + (Number(plan.total_price) || 0), 0)
  },

  actions: {
    /**
     * 加载方案物料库。
     */
    async fetchCatalog() {
      this.catalog = await planApi.getCatalog()
      return this.catalog
    },

    /**
     * 加载方案列表。
     */
    async fetchPlans() {
      this.loading = true
      try {
        const data = await planApi.getPlans()
        this.list = data.list || []
        return this.list
      } finally {
        this.loading = false
      }
    },

    /**
     * 生成方案。
     * @param {{ scope: string, tier: string }} payload
     */
    async generate(payload) {
      this.generating = true
      try {
        const plan = await planApi.generatePlan(payload)
        this.current = plan
        this.list.unshift(plan)
        return plan
      } finally {
        this.generating = false
      }
    },

    /**
     * 加载方案详情。
     * @param {string} id
     */
    async fetchPlan(id) {
      this.current = await planApi.getPlan(id)
      return this.current
    },

    /**
     * 提交审批（草稿 → 待审批）。
     * @param {string} id
     */
    async submit(id) {
      this.approving = true
      try {
        const plan = await planApi.submitPlan(id)
        this.applyPlan(plan)
        return plan
      } finally {
        this.approving = false
      }
    },

    /**
     * 审批（待审批 → 已通过 / 已驳回）。
     * @param {string} id
     * @param {{ approved: boolean, comment?: string }} payload
     */
    async approve(id, payload) {
      this.approving = true
      try {
        const plan = await planApi.approvePlan(id, payload)
        this.applyPlan(plan)
        return plan
      } finally {
        this.approving = false
      }
    },

    /**
     * 合并方案到列表与当前方案。
     * @param {Object} plan
     */
    applyPlan(plan) {
      if (!plan) return
      const index = this.list.findIndex((item) => item.id === plan.id)
      if (index >= 0) this.list[index] = { ...this.list[index], ...plan }
      this.current = plan
    }
  }
})
