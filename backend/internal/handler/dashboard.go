package handler

import (
	"github.com/gin-gonic/gin"

	"github.com/smart-home/hotel/backend/internal/pkg/response"
)

// DashboardOverview 经营看板核心指标（GET /dashboard/overview）。
func (h *Handler) DashboardOverview(c *gin.Context) {
	response.Success(c, h.svc.Overview())
}

// DashboardTrend 营收 / 入住率 / ADR 趋势（GET /dashboard/trend?days=）。
func (h *Handler) DashboardTrend(c *gin.Context) {
	response.Success(c, h.svc.Trend(c.Query("days")))
}

// RoomStatusDistribution 房态分布（GET /dashboard/room-status-distribution）。
func (h *Handler) RoomStatusDistribution(c *gin.Context) {
	response.Success(c, h.svc.RoomStatusDistribution())
}

// EnergySummary 能耗统计（GET /energy/summary?days=）。
func (h *Handler) EnergySummary(c *gin.Context) {
	response.Success(c, h.svc.EnergySummary(c.Query("days")))
}
