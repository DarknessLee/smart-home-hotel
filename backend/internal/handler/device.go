package handler

import (
	"github.com/gin-gonic/gin"

	"github.com/smart-home/hotel/backend/internal/pkg/response"
)

// ListDevices 查询设备（GET /devices）：
// 传 room_id 返回数组；否则返回分页对象。
func (h *Handler) ListDevices(c *gin.Context) {
	user, ok := h.currentUser(c)
	if !ok {
		return
	}
	result, err := h.svc.QueryDevices(
		user,
		c.Query("room_id"),
		c.Query("type"),
		c.Query("online_status"),
		c.Query("keyword"),
		c.Query("page"),
		c.Query("page_size"),
	)
	if err != nil {
		h.fail(c, err)
		return
	}
	response.Success(c, result)
}

// DeviceDetail 设备详情（GET /devices/:id）。
func (h *Handler) DeviceDetail(c *gin.Context) {
	user, ok := h.currentUser(c)
	if !ok {
		return
	}
	result, err := h.svc.DeviceDetail(user, c.Param("id"))
	if err != nil {
		h.fail(c, err)
		return
	}
	response.Success(c, result)
}

// UpdateDeviceProperties 下发设备属性（PATCH /devices/:id/properties）。
func (h *Handler) UpdateDeviceProperties(c *gin.Context) {
	user, ok := h.currentUser(c)
	if !ok {
		return
	}
	var patch map[string]any
	if !bindJSON(c, &patch) {
		return
	}
	result, err := h.svc.UpdateDeviceProperties(user, c.Param("id"), patch)
	if err != nil {
		h.fail(c, err)
		return
	}
	response.Success(c, result)
}

// CheckDevice 设备自检（POST /devices/:id/check）。
func (h *Handler) CheckDevice(c *gin.Context) {
	user, ok := h.currentUser(c)
	if !ok {
		return
	}
	result, err := h.svc.CheckDevice(user, c.Param("id"))
	if err != nil {
		h.fail(c, err)
		return
	}
	response.Success(c, result)
}

// RebindDevice 重新绑定（POST /devices/:id/rebind）。
func (h *Handler) RebindDevice(c *gin.Context) {
	result, err := h.svc.RebindDevice(c.Param("id"))
	if err != nil {
		h.fail(c, err)
		return
	}
	response.Success(c, result)
}

// RefreshDevices 刷新全量设备心跳（POST /devices/refresh）。
func (h *Handler) RefreshDevices(c *gin.Context) {
	response.Success(c, h.svc.RefreshDevices())
}

// DeviceRefreshOrNotFound 路由入口分发：/devices/refresh 复用 POST /devices/:id 入口
// （Gin 同层静态段与通配符段冲突限制），对外路径与契约一致。
func (h *Handler) DeviceRefreshOrNotFound(c *gin.Context) {
	if c.Param("id") == "refresh" {
		h.RefreshDevices(c)
		return
	}
	response.Fail(c, 404, "接口不存在")
}
