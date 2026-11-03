package service

import (
	"sort"
	"strings"

	"github.com/smart-home/hotel/backend/internal/model"
	"github.com/smart-home/hotel/backend/internal/pkg/apperr"
)

// PlanCatalog 方案物料库（GET /plans/catalog）。
func (s *Service) PlanCatalog() model.PlanCatalog {
	return s.store.PlanCatalog()
}

// ListPlans 方案列表（GET /plans，创建时间倒序）。
func (s *Service) ListPlans() model.PlanListResult {
	plans := s.store.Plans()
	list := make([]model.PlanView, 0, len(plans))
	for _, plan := range plans {
		list = append(list, plan.View())
	}
	sort.SliceStable(list, func(i, j int) bool {
		return list[i].CreatedAt > list[j].CreatedAt
	})
	return model.PlanListResult{List: list, Total: len(list)}
}

// GeneratePlan 方案生成：按 scope（room=1 / floor=10 / store=50 间）× tier 物料规则计算清单与总价。
func (s *Service) GeneratePlan(user model.User, scope, tier string) (*model.PlanView, error) {
	scope = strings.TrimSpace(scope)
	tier = strings.TrimSpace(tier)
	if scope == "" {
		scope = model.PlanScopeRoom
	}
	if tier == "" {
		tier = model.PlanTierComfort
	}

	catalog := s.store.PlanCatalog()
	scopeValid := false
	for _, option := range catalog.Scopes {
		if option.Value == scope {
			scopeValid = true
			break
		}
	}
	if !scopeValid {
		return nil, apperr.New(8001, "请选择有效的改造范围")
	}
	tierValid := false
	for _, option := range catalog.Tiers {
		if option.Value == tier {
			tierValid = true
			break
		}
	}
	if !tierValid {
		return nil, apperr.New(8002, "请选择有效的方案档次")
	}

	plan := s.store.BuildPlanDraft(scope, tier)
	if plan.ID == "" {
		return nil, apperr.New(8001, "请选择有效的改造范围")
	}
	creator := user.RealName
	if creator == "" {
		creator = "王经理"
	}
	plan.Creator = creator
	s.store.AddPlanFront(plan)

	view := plan.View()
	return &view, nil
}

// PlanDetail 方案详情。
func (s *Service) PlanDetail(id string) (*model.PlanView, error) {
	plan, found := s.store.PlanByID(id)
	if !found {
		return nil, apperr.New(404, "方案不存在")
	}
	view := plan.View()
	return &view, nil
}

// SubmitPlan 提交审批：draft → pending_approval。
func (s *Service) SubmitPlan(id string) (*model.PlanView, error) {
	plan, found := s.store.PlanByID(id)
	if !found {
		return nil, apperr.New(404, "方案不存在")
	}
	if plan.Status != model.PlanDraft {
		return nil, apperr.New(8003, "仅草稿可提交审批")
	}
	plan.Status = model.PlanPendingApproval
	s.store.SavePlan(plan)

	view := plan.View()
	return &view, nil
}

// ApprovePlan 审批：pending_approval → approved / rejected（仅店长，路由层 RBAC 拦截）。
func (s *Service) ApprovePlan(user model.User, id string, approved bool, comment string) (*model.PlanView, error) {
	plan, found := s.store.PlanByID(id)
	if !found {
		return nil, apperr.New(404, "方案不存在")
	}
	if plan.Status != model.PlanPendingApproval {
		return nil, apperr.New(8004, "仅待审批方案可审批")
	}
	if approved {
		plan.Status = model.PlanApproved
	} else {
		plan.Status = model.PlanRejected
	}
	approver := user.RealName
	if approver == "" {
		approver = "王经理"
	}
	plan.Approver = approver
	plan.Comment = comment
	plan.ApprovedAt = nowDateTime()
	s.store.SavePlan(plan)

	view := plan.View()
	return &view, nil
}
