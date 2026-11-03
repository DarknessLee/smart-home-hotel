package handler

import (
	"github.com/gin-gonic/gin"

	"github.com/smart-home/hotel/backend/internal/pkg/response"
)

// sceneExecuteRequest 执行场景请求。
type sceneExecuteRequest struct {
	RoomID string `json:"room_id"`
}

// ListScenes 预置场景列表（GET /scenes）。
func (h *Handler) ListScenes(c *gin.Context) {
	response.Success(c, h.svc.Scenes())
}

// ExecuteScene 一键执行场景（POST /scenes/:id/execute）。
func (h *Handler) ExecuteScene(c *gin.Context) {
	user, ok := h.currentUser(c)
	if !ok {
		return
	}
	var request sceneExecuteRequest
	if !bindJSON(c, &request) {
		return
	}
	result, err := h.svc.ExecuteScene(user, c.Param("id"), request.RoomID)
	if err != nil {
		h.fail(c, err)
		return
	}
	response.Success(c, result)
}
