/**
 * 住宿升级方案 Mock 接口（需求文档 4.3 核心特色模块）。
 */
import { PLAN_STATUS } from '@smart-home/utils'
import { MockError, currentUser, enrichPlan } from '../helpers.js'
import { buildPlanDraft, db, formatDateTime } from '../db.js'

/** @type {Array<Object>} */
export const planMock = [
  {
    method: 'GET',
    path: '/plans/catalog',
    delay: 180,
    handler: () => db.planCatalog
  },
  {
    method: 'GET',
    path: '/plans',
    delay: 240,
    handler: () => {
      const list = db.plans
        .slice()
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
        .map((plan) => enrichPlan(plan))
      return { list, total: list.length }
    }
  },
  {
    method: 'POST',
    path: '/plans/generate',
    delay: 620,
    /**
     * 方案生成器：选择范围 + 档次，返回设备清单与预算。
     * @param {{ body: { scope?: string, tier?: string, scope_value?: string } }} ctx
     */
    handler: ({ body, headers }) => {
      const scope = String(body.scope || 'room')
      const tier = String(body.tier || 'comfort')
      const validScope = db.planCatalog.scopes.some((item) => item.value === scope)
      const validTier = db.planCatalog.tiers.some((item) => item.value === tier)
      if (!validScope) throw new MockError(8001, '请选择有效的改造范围')
      if (!validTier) throw new MockError(8002, '请选择有效的方案档次')

      const plan = buildPlanDraft(scope, tier)
      plan.creator = currentUser(headers)?.real_name || '王经理'
      db.plans.unshift(plan)
      return enrichPlan(plan)
    }
  },
  {
    method: 'GET',
    path: '/plans/:id',
    delay: 180,
    handler: ({ params }) => {
      const plan = db.plans.find((item) => item.id === params.id)
      if (!plan) throw new MockError(404, '方案不存在')
      return enrichPlan(plan)
    }
  },
  {
    method: 'POST',
    path: '/plans/:id/submit',
    delay: 320,
    handler: ({ params }) => {
      const plan = db.plans.find((item) => item.id === params.id)
      if (!plan) throw new MockError(404, '方案不存在')
      if (plan.status !== PLAN_STATUS.DRAFT) throw new MockError(8003, '仅草稿可提交审批')
      plan.status = PLAN_STATUS.PENDING_APPROVAL
      return enrichPlan(plan)
    }
  },
  {
    method: 'POST',
    path: '/plans/:id/approve',
    delay: 420,
    /**
     * 店长审批（需求：店长拥有方案审批权限）。
     * @param {{ params: { id: string }, body: { approved?: boolean, comment?: string }, headers: Object }} ctx
     */
    handler: ({ params, body, headers }) => {
      const plan = db.plans.find((item) => item.id === params.id)
      if (!plan) throw new MockError(404, '方案不存在')
      if (plan.status !== PLAN_STATUS.PENDING_APPROVAL) throw new MockError(8004, '仅待审批方案可审批')
      const approved = body.approved !== false
      plan.status = approved ? PLAN_STATUS.APPROVED : PLAN_STATUS.REJECTED
      plan.approver = currentUser(headers)?.real_name || '王经理'
      plan.comment = String(body.comment || '')
      plan.approved_at = formatDateTime(Date.now())
      return enrichPlan(plan)
    }
  }
]
