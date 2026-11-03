// Package response 统一 HTTP 响应封装。
//
// 响应结构与 docs/api-contract.md 1.2 节完全一致：
//
//	{ "code": 0, "message": "ok", "data": {} }
//
// 约定：
//   - 成功 code = 0；
//   - 业务失败 code 为契约错误码，HTTP 状态码仍为 200（与前端 Mock 行为一致）；
//   - 仅「请求体 JSON 解析失败」这类参数错误使用 HTTP 400。
package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Body 统一响应体。
type Body struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    any    `json:"data"`
}

// Success 返回成功响应（HTTP 200）。
func Success(c *gin.Context, data any) {
	c.JSON(http.StatusOK, Body{Code: 0, Message: "ok", Data: data})
}

// Fail 返回业务失败响应：HTTP 状态保持 200，业务错误码写入 body.code。
func Fail(c *gin.Context, code int, message string) {
	c.JSON(http.StatusOK, Body{Code: code, Message: message, Data: nil})
}

// BadRequest 返回参数解析失败响应（HTTP 400，body.code = 400）。
func BadRequest(c *gin.Context, message string) {
	c.JSON(http.StatusBadRequest, Body{Code: 400, Message: message, Data: nil})
}

// Paginated 返回契约统一分页结构 {list,total,page,page_size}。
func Paginated(c *gin.Context, list any, total, page, pageSize int) {
	Success(c, gin.H{
		"list":      list,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}
