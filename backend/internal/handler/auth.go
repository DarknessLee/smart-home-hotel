package handler

import (
	"github.com/gin-gonic/gin"

	"github.com/smart-home/hotel/backend/internal/middleware"
	"github.com/smart-home/hotel/backend/internal/pkg/response"
)

// loginRequest 顾客登录请求。
type loginRequest struct {
	Phone string `json:"phone"`
	Code  string `json:"code"`
}

// staffLoginRequest 员工登录请求。
type staffLoginRequest struct {
	Role string `json:"role"`
}

// realNameRequest 实名认证请求（image 为可选上传占位）。
type realNameRequest struct {
	RealName string `json:"real_name"`
	IDCard   string `json:"id_card"`
	Image    string `json:"image"`
}

// Login 顾客登录（POST /auth/login）：任意手机号 + 验证码 1234。
func (h *Handler) Login(c *gin.Context) {
	var request loginRequest
	if !bindJSON(c, &request) {
		return
	}
	result, err := h.svc.Login(request.Phone, request.Code)
	if err != nil {
		h.fail(c, err)
		return
	}
	response.Success(c, result)
}

// StaffLogin B 端员工登录（POST /auth/staff-login）。
func (h *Handler) StaffLogin(c *gin.Context) {
	var request staffLoginRequest
	if !bindJSON(c, &request) {
		return
	}
	result, err := h.svc.StaffLogin(request.Role)
	if err != nil {
		h.fail(c, err)
		return
	}
	response.Success(c, result)
}

// Profile 当前用户（GET /auth/profile）。
func (h *Handler) Profile(c *gin.Context) {
	user, ok := h.currentUser(c)
	if !ok {
		return
	}
	result, err := h.svc.Profile(user.ID)
	if err != nil {
		h.fail(c, err)
		return
	}
	response.Success(c, result)
}

// RealName 实名认证（POST /auth/real-name）。
func (h *Handler) RealName(c *gin.Context) {
	user, ok := h.currentUser(c)
	if !ok {
		return
	}
	var request realNameRequest
	if !bindJSON(c, &request) {
		return
	}
	result, err := h.svc.RealName(user.ID, request.RealName, request.IDCard)
	if err != nil {
		h.fail(c, err)
		return
	}
	response.Success(c, result)
}

// Logout 退出登录（POST /auth/logout）：Mock 阶段无服务端会话，直接返回 null。
func (h *Handler) Logout(c *gin.Context) {
	response.Success(c, nil)
}

// DemoAccounts 演示账号列表（GET /auth/demo-accounts）。
func (h *Handler) DemoAccounts(c *gin.Context) {
	response.Success(c, h.svc.DemoAccounts())
}

// Me 当前用户或 null（GET /auth/me）。
func (h *Handler) Me(c *gin.Context) {
	user, ok := middleware.CurrentUser(c)
	if !ok {
		response.Success(c, nil)
		return
	}
	response.Success(c, h.svc.Me(user.ID))
}
