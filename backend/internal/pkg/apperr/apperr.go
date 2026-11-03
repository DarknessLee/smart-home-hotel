// Package apperr 定义统一的业务错误类型。
//
// 设计目标：
//  1. service 层只关心「业务错误码 + 可直接展示的中文提示」，不依赖 Gin；
//  2. handler 层通过 apperr.From 取出错误码并写入统一响应体 {code,message,data}；
//  3. 错误码与 docs/api-contract.md 第 1.3 节保持一致（HTTP 状态保持 200）。
package apperr

import "errors"

// Error 业务错误：Code 为契约错误码，Message 为可直接展示给用户的提示文案。
type Error struct {
	Code    int
	Message string
}

// Error 实现 error 接口。
func (e *Error) Error() string {
	return e.Message
}

// New 创建一个业务错误。
func New(code int, message string) *Error {
	return &Error{Code: code, Message: message}
}

// From 将任意 error 转换为契约错误码 + 提示文案；非业务错误统一按 500 处理。
func From(err error) (int, string) {
	var target *Error
	if errors.As(err, &target) {
		return target.Code, target.Message
	}
	return 500, "服务内部错误"
}

// Is 判断 err 是否为指定错误码的业务错误（便于测试与分支处理）。
func Is(err error, code int) bool {
	var target *Error
	if errors.As(err, &target) {
		return target.Code == code
	}
	return false
}
