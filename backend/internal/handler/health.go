package handler

import (
	"time"

	"github.com/gin-gonic/gin"

	"github.com/smart-home/hotel/backend/internal/pkg/response"
)

// Health 健康检查：GET /health、GET /api/health。
func (h *Handler) Health(c *gin.Context) {
	response.Success(c, gin.H{
		"status":  "ok",
		"service": "smart-home-hotel-backend",
		"version": "0.1.0",
		"time":    time.Now().Format("2006-01-02 15:04:05"),
	})
}
