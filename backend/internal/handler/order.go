package handler

import (
	"github.com/gin-gonic/gin"

	"github.com/smart-home/hotel/backend/internal/pkg/response"
	"github.com/smart-home/hotel/backend/internal/service"
)

// createOrderRequest 创建订单请求（POST /orders）。
type createOrderRequest struct {
	RoomTypeID   string `json:"room_type_id"`
	RoomID       string `json:"room_id"`
	CheckInTime  string `json:"check_in_time"`
	CheckOutTime string `json:"check_out_time"`
	GuestName    string `json:"guest_name"`
	GuestPhone   string `json:"guest_phone"`
	Remark       string `json:"remark"`
}

// refundRequest 申请退款请求（reason 可选）。
type refundRequest struct {
	Reason string `json:"reason"`
}

// reviewRequest 评价请求。
type reviewRequest struct {
	Rating  int    `json:"rating"`
	Content string `json:"content"`
}

// CreateOrder 创建订单（POST /orders）。
func (h *Handler) CreateOrder(c *gin.Context) {
	user, ok := h.currentUser(c)
	if !ok {
		return
	}
	var request createOrderRequest
	if !bindJSON(c, &request) {
		return
	}
	result, err := h.svc.CreateOrder(user, service.CreateOrderInput{
		RoomTypeID:   request.RoomTypeID,
		RoomID:       request.RoomID,
		CheckInTime:  request.CheckInTime,
		CheckOutTime: request.CheckOutTime,
		GuestName:    request.GuestName,
		GuestPhone:   request.GuestPhone,
		Remark:       request.Remark,
	})
	if err != nil {
		h.fail(c, err)
		return
	}
	response.Success(c, result)
}

// ListOrders 订单列表（GET /orders）。
func (h *Handler) ListOrders(c *gin.Context) {
	user, ok := h.currentUser(c)
	if !ok {
		return
	}
	self := c.Query("self") == "1" || c.Query("self") == "true"
	result := h.svc.ListOrders(
		user,
		self,
		c.Query("status"),
		c.Query("keyword"),
		c.Query("room_id"),
		c.Query("page"),
		c.Query("page_size"),
	)
	response.Success(c, result)
}

// OrderDetail 订单详情（GET /orders/:id，支持 id 或订单号）。
func (h *Handler) OrderDetail(c *gin.Context) {
	user, ok := h.currentUser(c)
	if !ok {
		return
	}
	result, err := h.svc.OrderDetail(user, c.Param("id"))
	if err != nil {
		h.fail(c, err)
		return
	}
	response.Success(c, result)
}

// PayOrder 支付（POST /orders/:id/pay）。
func (h *Handler) PayOrder(c *gin.Context) {
	user, ok := h.currentUser(c)
	if !ok {
		return
	}
	result, err := h.svc.PayOrder(user, c.Param("id"))
	if err != nil {
		h.fail(c, err)
		return
	}
	response.Success(c, result)
}

// CancelOrder 取消订单（POST /orders/:id/cancel）。
func (h *Handler) CancelOrder(c *gin.Context) {
	user, ok := h.currentUser(c)
	if !ok {
		return
	}
	result, err := h.svc.CancelOrder(user, c.Param("id"))
	if err != nil {
		h.fail(c, err)
		return
	}
	response.Success(c, result)
}

// RefundOrder 申请退款（POST /orders/:id/refund）。
func (h *Handler) RefundOrder(c *gin.Context) {
	user, ok := h.currentUser(c)
	if !ok {
		return
	}
	var request refundRequest
	if !bindJSON(c, &request) {
		return
	}
	result, err := h.svc.RefundOrder(user, c.Param("id"), request.Reason)
	if err != nil {
		h.fail(c, err)
		return
	}
	response.Success(c, result)
}

// ConfirmRefund 确认退款（POST /orders/:id/refund/confirm，B 端）。
func (h *Handler) ConfirmRefund(c *gin.Context) {
	result, err := h.svc.ConfirmRefund(c.Param("id"))
	if err != nil {
		h.fail(c, err)
		return
	}
	response.Success(c, result)
}

// CheckInOrder 办理入住（POST /orders/:id/check-in）。
func (h *Handler) CheckInOrder(c *gin.Context) {
	user, ok := h.currentUser(c)
	if !ok {
		return
	}
	result, err := h.svc.CheckIn(user, c.Param("id"))
	if err != nil {
		h.fail(c, err)
		return
	}
	response.Success(c, result)
}

// CheckOutOrder 办理退房（POST /orders/:id/check-out）。
func (h *Handler) CheckOutOrder(c *gin.Context) {
	user, ok := h.currentUser(c)
	if !ok {
		return
	}
	result, err := h.svc.CheckOut(user, c.Param("id"))
	if err != nil {
		h.fail(c, err)
		return
	}
	response.Success(c, result)
}

// ReviewOrder 评价（POST /orders/:id/review）。
func (h *Handler) ReviewOrder(c *gin.Context) {
	user, ok := h.currentUser(c)
	if !ok {
		return
	}
	var request reviewRequest
	if !bindJSON(c, &request) {
		return
	}
	result, err := h.svc.ReviewOrder(user, c.Param("id"), request.Rating, request.Content)
	if err != nil {
		h.fail(c, err)
		return
	}
	response.Success(c, result)
}

// OrderTimeline 订单状态时间轴（GET /orders/:id/timeline）。
func (h *Handler) OrderTimeline(c *gin.Context) {
	user, ok := h.currentUser(c)
	if !ok {
		return
	}
	if _, err := h.svc.OrderDetail(user, c.Param("id")); err != nil {
		h.fail(c, err)
		return
	}
	result, err := h.svc.OrderTimeline(c.Param("id"))
	if err != nil {
		h.fail(c, err)
		return
	}
	response.Success(c, result)
}
