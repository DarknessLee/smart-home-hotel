package handler

import (
	"github.com/gin-gonic/gin"

	"github.com/smart-home/hotel/backend/internal/pkg/response"
)

// ListAlarms 告警列表（GET /alarms?status=&type=&level=）。
func (h *Handler) ListAlarms(c *gin.Context) {
	result := h.svc.ListAlarms(c.Query("status"), c.Query("type"), c.Query("level"))
	response.Success(c, result)
}

// HandleAlarm 处理告警（POST /alarms/:id/handle）。
func (h *Handler) HandleAlarm(c *gin.Context) {
	user, ok := h.currentUser(c)
	if !ok {
		return
	}
	result, err := h.svc.HandleAlarm(user, c.Param("id"))
	if err != nil {
		h.fail(c, err)
		return
	}
	response.Success(c, result)
}
