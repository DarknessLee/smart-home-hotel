// Package service 业务逻辑层。
//
// 职责：
//   - 实现订单状态机、房态机、设备属性校验、场景批量下发、方案生成等业务规则；
//   - 组合 internal/store 的读写能力，返回 model 层实体 / 视图；
//   - 不依赖 Gin，业务错误统一返回 *apperr.Error（契约错误码）。
//
// 依赖方向：handler -> service -> store -> model。
package service

import (
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/smart-home/hotel/backend/internal/store"
)

// Service 聚合全部业务用例；后续接入 MySQL/Redis 时只需替换 store 实现。
type Service struct {
	store *store.Store
}

// New 创建业务服务实例。
func New(st *store.Store) *Service {
	return &Service{store: st}
}

// formatDateTime 格式化为契约时间格式 YYYY-MM-DD HH:mm。
func formatDateTime(value time.Time) string {
	return value.Format("2006-01-02 15:04")
}

// formatDate 格式化为契约日期格式 YYYY-MM-DD。
func formatDate(value time.Time) string {
	return value.Format("2006-01-02")
}

// nowDateTime 当前时间（YYYY-MM-DD HH:mm）。
func nowDateTime() string {
	return formatDateTime(time.Now())
}

// nowISO8601 当前时间的 ISO8601 字符串（场景执行时间，与前端 toISOString 一致）。
func nowISO8601() string {
	return time.Now().UTC().Format("2006-01-02T15:04:05.000Z")
}

// roundTo 四舍五入保留指定小数位（对齐前端 Number(toFixed(n))）。
func roundTo(value float64, digits int) float64 {
	factor := math.Pow(10, float64(digits))
	return math.Round(value*factor) / factor
}

// parsePositiveInt 解析正整数 query 参数，非法或缺省时返回 fallback。
func parsePositiveInt(text string, fallback int) int {
	text = strings.TrimSpace(text)
	if text == "" {
		return fallback
	}
	value, err := strconv.Atoi(text)
	if err != nil || value <= 0 {
		return fallback
	}
	return value
}

// clampDays 规整 days 参数到 [7, 30]（GET /dashboard/trend、/energy/summary）。
func clampDays(text string) int {
	days := parsePositiveInt(text, 30)
	if days < 7 {
		days = 7
	}
	if days > 30 {
		days = 30
	}
	return days
}
