package handler

import (
	"github.com/gin-gonic/gin"

	"github.com/smart-home/hotel/backend/internal/pkg/response"
)

// generatePlanRequest 方案生成请求。
type generatePlanRequest struct {
	Scope string `json:"scope"`
	Tier  string `json:"tier"`
}

// approvePlanRequest 审批请求（approved 缺省视为通过）。
type approvePlanRequest struct {
	Approved *bool  `json:"approved"`
	Comment  string `json:"comment"`
}

// PlanCatalog 物料库（GET /plans/catalog）。
func (h *Handler) PlanCatalog(c *gin.Context) {
	response.Success(c, h.svc.PlanCatalog())
}

// ListPlans 方案列表（GET /plans）。
func (h *Handler) ListPlans(c *gin.Context) {
	response.Success(c, h.svc.ListPlans())
}

// GeneratePlan 方案生成（POST /plans/generate）。
func (h *Handler) GeneratePlan(c *gin.Context) {
	user, ok := h.currentUser(c)
	if !ok {
		return
	}
	var request generatePlanRequest
	if !bindJSON(c, &request) {
		return
	}
	result, err := h.svc.GeneratePlan(user, request.Scope, request.Tier)
	if err != nil {
		h.fail(c, err)
		return
	}
	response.Success(c, result)
}

// PlanDetail 方案详情（GET /plans/:id）。
func (h *Handler) PlanDetail(c *gin.Context) {
	result, err := h.svc.PlanDetail(c.Param("id"))
	if err != nil {
		h.fail(c, err)
		return
	}
	response.Success(c, result)
}

// PlanDetailOrCatalog 路由入口分发：/plans/catalog 复用 GET /plans/:id 入口
// （Gin 同层静态段与通配符段冲突限制），对外路径与契约一致。
func (h *Handler) PlanDetailOrCatalog(c *gin.Context) {
	if c.Param("id") == "catalog" {
		h.PlanCatalog(c)
		return
	}
	h.PlanDetail(c)
}

// SubmitPlan 提交审批（POST /plans/:id/submit）。
func (h *Handler) SubmitPlan(c *gin.Context) {
	result, err := h.svc.SubmitPlan(c.Param("id"))
	if err != nil {
		h.fail(c, err)
		return
	}
	response.Success(c, result)
}

// ApprovePlan 审批（POST /plans/:id/approve，仅店长）。
func (h *Handler) ApprovePlan(c *gin.Context) {
	user, ok := h.currentUser(c)
	if !ok {
		return
	}
	var request approvePlanRequest
	if !bindJSON(c, &request) {
		return
	}
	approved := true
	if request.Approved != nil {
		approved = *request.Approved
	}
	result, err := h.svc.ApprovePlan(user, c.Param("id"), approved, request.Comment)
	if err != nil {
		h.fail(c, err)
		return
	}
	response.Success(c, result)
}

// PlanGenerateOrNotFound 路由入口分发：/plans/generate 复用 POST /plans/:id 入口
// （Gin 同层静态段与通配符段冲突限制），对外路径与契约一致。
func (h *Handler) PlanGenerateOrNotFound(c *gin.Context) {
	if c.Param("id") == "generate" {
		h.GeneratePlan(c)
		return
	}
	response.Fail(c, 404, "接口不存在")
}
