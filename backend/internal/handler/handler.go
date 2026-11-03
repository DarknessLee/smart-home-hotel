// Package handler HTTP 适配层（Gin）。
//
// 职责：参数绑定、调用 service、把业务错误码写入统一响应 {code,message,data}。
// 依赖方向：router -> handler -> service -> store -> model。
package handler

import (
	"bytes"
	"encoding/json"
	"errors"
	"log"

	"github.com/gin-gonic/gin"

	"github.com/smart-home/hotel/backend/internal/middleware"
	"github.com/smart-home/hotel/backend/internal/model"
	"github.com/smart-home/hotel/backend/internal/pkg/apperr"
	"github.com/smart-home/hotel/backend/internal/pkg/response"
	"github.com/smart-home/hotel/backend/internal/service"
)

// Handler 聚合全部 HTTP 处理器。
type Handler struct {
	svc *service.Service
}

// New 创建 HTTP 处理器。
func New(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// bindJSON 解析 JSON 请求体。
// 契约中多数写接口的 body 字段可选（如退款 reason、评价 content、审批 comment），
// 因此空 body 视为 {}；只有真正的 JSON 语法错误才返回 HTTP 400。
func bindJSON(c *gin.Context, target any) bool {
	data, err := c.GetRawData()
	if err != nil {
		response.BadRequest(c, "请求参数读取失败")
		return false
	}
	if len(bytes.TrimSpace(data)) == 0 {
		return true
	}
	if err := json.Unmarshal(data, target); err != nil {
		response.BadRequest(c, "请求参数格式错误")
		return false
	}
	return true
}

// currentUser 读取登录用户（鉴权中间件已保证存在，这里做防御式处理）。
func (h *Handler) currentUser(c *gin.Context) (model.User, bool) {
	user, found := middleware.CurrentUser(c)
	if !found {
		h.fail(c, apperr.New(401, "登录已失效，请重新登录"))
		return model.User{}, false
	}
	return user, true
}

// fail 业务错误 -> 统一响应；未知错误记录日志并按 500 处理。
func (h *Handler) fail(c *gin.Context, err error) {
	var appError *apperr.Error
	if !errors.As(err, &appError) {
		log.Printf("[handler] unexpected error: %v", err)
	}
	code, message := apperr.From(err)
	response.Fail(c, code, message)
}
