package handler

import (
	"github.com/gin-gonic/gin"

	"github.com/smart-home/hotel/backend/internal/pkg/response"
)

// roomStatusRequest 修改房态请求。
type roomStatusRequest struct {
	Status string `json:"status"`
}

// Stores 门店列表（GET /stores）。
func (h *Handler) Stores(c *gin.Context) {
	response.Success(c, h.svc.Stores())
}

// RoomTypes 房型列表（GET /room-types?store_id=）。
func (h *Handler) RoomTypes(c *gin.Context) {
	response.Success(c, h.svc.RoomTypes(c.Query("store_id")))
}

// RoomAvailability 按日期查可售房型（GET /rooms/availability）。
func (h *Handler) RoomAvailability(c *gin.Context) {
	response.Success(c, h.svc.RoomAvailability(c.Query("check_in_time"), c.Query("check_out_time")))
}

// Rooms 房态列表（GET /rooms）。
func (h *Handler) Rooms(c *gin.Context) {
	result := h.svc.ListRooms(
		c.Query("store_id"),
		c.Query("status"),
		c.Query("floor"),
		c.Query("room_type_id"),
		c.Query("keyword"),
	)
	response.Success(c, result)
}

// RoomDetailOrAvailability 路由入口分发：
// Gin 路由树不允许同一层「静态段 + 通配符段」共存（httprouter 限制），
// 因此 /rooms/availability 复用 /rooms/:id 入口，对外路径与契约完全一致。
func (h *Handler) RoomDetailOrAvailability(c *gin.Context) {
	if c.Param("id") == "availability" {
		h.RoomAvailability(c)
		return
	}
	h.RoomDetail(c)
}

// RoomDetail 房间详情（GET /rooms/:id，含 devices）。
func (h *Handler) RoomDetail(c *gin.Context) {
	result, err := h.svc.RoomDetail(c.Param("id"))
	if err != nil {
		h.fail(c, err)
		return
	}
	response.Success(c, result)
}

// RoomDevices 房间设备（GET /rooms/:id/devices）。
func (h *Handler) RoomDevices(c *gin.Context) {
	result, err := h.svc.RoomDevices(c.Param("id"))
	if err != nil {
		h.fail(c, err)
		return
	}
	response.Success(c, result)
}

// UpdateRoomStatus 修改房态（PATCH /rooms/:id/status，前台 / 店长）。
func (h *Handler) UpdateRoomStatus(c *gin.Context) {
	var request roomStatusRequest
	if !bindJSON(c, &request) {
		return
	}
	result, err := h.svc.UpdateRoomStatus(c.Param("id"), request.Status)
	if err != nil {
		h.fail(c, err)
		return
	}
	response.Success(c, result)
}

// CleanRoom 保洁完成（POST /rooms/:id/clean）。
func (h *Handler) CleanRoom(c *gin.Context) {
	result, err := h.svc.CleanRoom(c.Param("id"))
	if err != nil {
		h.fail(c, err)
		return
	}
	response.Success(c, result)
}

// MaintenanceRoom 标记维修（POST /rooms/:id/maintenance）。
func (h *Handler) MaintenanceRoom(c *gin.Context) {
	result, err := h.svc.MaintenanceRoom(c.Param("id"))
	if err != nil {
		h.fail(c, err)
		return
	}
	response.Success(c, result)
}
