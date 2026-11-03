package service

import (
	"math"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/smart-home/hotel/backend/internal/model"
	"github.com/smart-home/hotel/backend/internal/pkg/apperr"
)

// CreateOrderInput 创建订单请求（POST /orders）。
type CreateOrderInput struct {
	RoomTypeID   string
	RoomID       string
	CheckInTime  string
	CheckOutTime string
	GuestName    string
	GuestPhone   string
	Remark       string
}

// CreateOrder 创建订单：初始状态 pending_payment，并锁定房间为 reserved。
func (s *Service) CreateOrder(user model.User, input CreateOrderInput) (*model.OrderView, error) {
	var room model.Room
	var found bool

	roomID := strings.TrimSpace(input.RoomID)
	if roomID != "" {
		room, found = s.store.RoomByID(roomID)
		if !found {
			return nil, apperr.New(404, "房间不存在")
		}
		if room.Status != model.RoomVacantReady {
			return nil, apperr.New(4004, "该房间当前不可预订")
		}
	} else {
		roomTypeID := strings.TrimSpace(input.RoomTypeID)
		if roomTypeID == "" {
			return nil, apperr.New(4005, "请选择房型")
		}
		roomTypeFound := false
		for _, roomType := range s.store.RoomTypes("") {
			if roomType.ID == roomTypeID {
				roomTypeFound = true
				break
			}
		}
		if !roomTypeFound {
			return nil, apperr.New(4005, "请选择房型")
		}
		for _, candidate := range s.store.Rooms() {
			if candidate.RoomTypeID == roomTypeID && candidate.Status == model.RoomVacantReady {
				room = candidate
				found = true
				break
			}
		}
		if !found {
			return nil, apperr.New(4006, "该房型暂无可售房间，请更换日期或房型")
		}
	}

	checkInAt, err := parseBookDate(input.CheckInTime, 14, 0)
	if err != nil {
		return nil, err
	}
	checkOutAt, err := parseBookDate(input.CheckOutTime, 12, 0)
	if err != nil {
		return nil, err
	}
	nights := int(math.Round(checkOutAt.Sub(checkInAt).Hours() / 24))
	if nights < 1 {
		return nil, apperr.New(4007, "离店日期需晚于入住日期")
	}

	guestName := strings.TrimSpace(input.GuestName)
	if guestName == "" {
		guestName = user.RealName
	}
	if guestName == "" {
		guestName = "散客"
	}
	guestPhone := strings.TrimSpace(input.GuestPhone)
	if guestPhone == "" {
		guestPhone = user.Phone
	}

	now := time.Now()
	order := model.Order{
		ID:           "ORD_" + s.orderIDPart(),
		OrderNo:      s.store.NextOrderNo(now),
		UserID:       user.ID,
		RoomID:       room.ID,
		RoomTypeID:   room.RoomTypeID,
		RoomNo:       room.RoomNo,
		TypeName:     room.TypeName,
		Price:        room.Price,
		Nights:       nights,
		Amount:       room.Price * float64(nights),
		Status:       model.OrderPendingPayment,
		CheckInTime:  formatDateTime(checkInAt),
		CheckOutTime: formatDateTime(checkOutAt),
		GuestName:    guestName,
		GuestPhone:   guestPhone,
		CreatedAt:    formatDateTime(now),
		Remark:       input.Remark,
		Source:       "c_app",
	}
	s.store.AddOrder(order)

	// 下单即占房：房间转已预订（待支付超时释放属于后期业务，Mock 阶段简化）
	room.Status = model.RoomReserved
	room.CurrentOrderID = order.ID
	room.GuestName = order.GuestName
	room.GuestPhone = order.GuestPhone
	room.CheckInTime = order.CheckInTime
	room.CheckOutTime = order.CheckOutTime
	s.store.SaveRoom(room)

	view := order.View()
	return &view, nil
}

// orderIDPart 生成订单 id 的时间部分。
func (s *Service) orderIDPart() string {
	return strconv.FormatInt(time.Now().UnixNano(), 10)
}

// parseBookDate 解析 YYYY-MM-DD 并按固定时刻（入住 14:00 / 离店 12:00）构造本地时间。
func parseBookDate(value string, hour, minute int) (time.Time, error) {
	dateText := strings.TrimSpace(value)
	if len(dateText) >= 10 {
		dateText = dateText[:10]
	}
	parsed, err := time.ParseInLocation("2006-01-02", dateText, time.Local)
	if err != nil {
		return time.Time{}, apperr.New(4001, "日期格式应为 YYYY-MM-DD")
	}
	return time.Date(parsed.Year(), parsed.Month(), parsed.Day(), hour, minute, 0, 0, time.Local), nil
}

// ListOrders 订单列表。
// 顾客仅能看到自己的订单；B 端员工按权限查看全量订单（self=1 时只看自己）。
func (s *Service) ListOrders(user model.User, self bool, status, keyword, roomID, pageText, pageSizeText string) model.OrderListResult {
	status = strings.TrimSpace(status)
	roomID = strings.TrimSpace(roomID)
	keyword = strings.ToLower(strings.TrimSpace(keyword))

	filtered := make([]model.Order, 0, len(s.store.Orders()))
	for _, order := range s.store.Orders() {
		if order.UserID != user.ID && (self || user.Role == model.RoleCustomer) {
			continue
		}
		if status != "" && order.Status != status {
			continue
		}
		if roomID != "" && order.RoomID != roomID {
			continue
		}
		if keyword != "" {
			text := strings.ToLower(order.OrderNo + " " + order.RoomNo + " " + order.GuestName + " " + order.GuestPhone)
			if !strings.Contains(text, keyword) {
				continue
			}
		}
		filtered = append(filtered, order)
	}

	// 创建时间倒序（时间格式 YYYY-MM-DD HH:mm 可直接字符串比较）
	sort.SliceStable(filtered, func(i, j int) bool {
		return filtered[i].CreatedAt > filtered[j].CreatedAt
	})

	page := parsePositiveInt(pageText, 1)
	pageSize := parsePositiveInt(pageSizeText, 0)
	if pageSize == 0 {
		if strings.TrimSpace(pageText) != "" {
			pageSize = 10
		} else {
			pageSize = len(filtered)
		}
	}
	if pageSize < 1 {
		pageSize = 1
	}

	start := (page - 1) * pageSize
	if start > len(filtered) {
		start = len(filtered)
	}
	end := start + pageSize
	if end > len(filtered) {
		end = len(filtered)
	}
	views := make([]model.OrderView, 0, end-start)
	for _, order := range filtered[start:end] {
		views = append(views, order.View())
	}
	return model.OrderListResult{List: views, Total: len(filtered), Page: page, PageSize: pageSize}
}

// findOrderOrError 查询订单，不存在时返回 404。
func (s *Service) findOrderOrError(idOrNo string) (model.Order, error) {
	order, found := s.store.OrderByIDOrNo(idOrNo)
	if !found {
		return model.Order{}, apperr.New(404, "订单不存在")
	}
	return order, nil
}

// ensureOrderAccess 顾客只能操作自己的订单（B 端员工按 RBAC 放行）。
func ensureOrderAccess(user model.User, order model.Order) error {
	if user.Role == model.RoleCustomer && order.UserID != user.ID {
		return apperr.New(403, "无权操作该订单")
	}
	return nil
}

// orderTransitionMessage 生成非法流转提示（与前端 Mock 文案一致）。
func orderTransitionMessage(from, to string) string {
	return "订单状态不允许该操作：" + from + " → " + to
}

// OrderDetail 订单详情（支持订单 id 或订单号）。
func (s *Service) OrderDetail(user model.User, idOrNo string) (*model.OrderView, error) {
	order, err := s.findOrderOrError(idOrNo)
	if err != nil {
		return nil, err
	}
	if err := ensureOrderAccess(user, order); err != nil {
		return nil, err
	}
	view := order.View()
	return &view, nil
}

// PayOrder 支付：待支付 → 已支付 → 已确认（Mock 支付回调连续流转）。
func (s *Service) PayOrder(user model.User, idOrNo string) (*model.OrderView, error) {
	order, err := s.findOrderOrError(idOrNo)
	if err != nil {
		return nil, err
	}
	if err := ensureOrderAccess(user, order); err != nil {
		return nil, err
	}
	if !model.CanOrderTransition(order.Status, model.OrderPaid) {
		return nil, apperr.New(4002, "当前订单状态不可支付")
	}
	order.Status = model.OrderPaid
	order.PaidAt = nowDateTime()
	// Mock 支付成功后自动确认（跳过人工审核）
	order.Status = model.OrderConfirmed
	s.store.SaveOrder(order)
	s.syncRoomByOrder(order, model.RoomReserved, order.UserID)

	view := order.View()
	return &view, nil
}

// CancelOrder 取消订单：待支付 → 已取消，释放房间。
func (s *Service) CancelOrder(user model.User, idOrNo string) (*model.OrderView, error) {
	order, err := s.findOrderOrError(idOrNo)
	if err != nil {
		return nil, err
	}
	if err := ensureOrderAccess(user, order); err != nil {
		return nil, err
	}
	if !model.CanOrderTransition(order.Status, model.OrderCancelled) {
		return nil, apperr.New(4002, orderTransitionMessage(order.Status, model.OrderCancelled))
	}
	order.Status = model.OrderCancelled
	order.CancelledAt = nowDateTime()
	s.store.SaveOrder(order)
	s.syncRoomByOrder(order, model.RoomVacantReady, order.UserID)

	view := order.View()
	return &view, nil
}

// RefundOrder 申请退款：已支付 / 已确认 / 待入住 → 退款中。
func (s *Service) RefundOrder(user model.User, idOrNo, reason string) (*model.OrderView, error) {
	order, err := s.findOrderOrError(idOrNo)
	if err != nil {
		return nil, err
	}
	if err := ensureOrderAccess(user, order); err != nil {
		return nil, err
	}
	if !model.CanOrderTransition(order.Status, model.OrderRefunding) {
		return nil, apperr.New(4002, orderTransitionMessage(order.Status, model.OrderRefunding))
	}
	order.Status = model.OrderRefunding
	order.RefundReason = strings.TrimSpace(reason)
	if order.RefundReason == "" {
		order.RefundReason = "顾客申请退款"
	}
	s.store.SaveOrder(order)

	view := order.View()
	return &view, nil
}

// ConfirmRefund 确认退款（B 端）：退款中 → 已退款，释放房间。
func (s *Service) ConfirmRefund(idOrNo string) (*model.OrderView, error) {
	order, err := s.findOrderOrError(idOrNo)
	if err != nil {
		return nil, err
	}
	if !model.CanOrderTransition(order.Status, model.OrderRefunded) {
		return nil, apperr.New(4002, orderTransitionMessage(order.Status, model.OrderRefunded))
	}
	order.Status = model.OrderRefunded
	order.RefundAt = nowDateTime()
	s.store.SaveOrder(order)
	s.syncRoomByOrder(order, model.RoomVacantReady, order.UserID)

	view := order.View()
	return &view, nil
}

// CheckIn 办理入住：已确认 / 待入住 / 已支付 → 已入住，绑定用户 current_room_id。
func (s *Service) CheckIn(user model.User, idOrNo string) (*model.OrderView, error) {
	order, err := s.findOrderOrError(idOrNo)
	if err != nil {
		return nil, err
	}
	if user.Role == model.RoleCustomer && order.UserID != user.ID {
		return nil, apperr.New(403, "无权操作该订单")
	}
	isSelf := order.UserID == user.ID
	if isSelf && user.Role == model.RoleCustomer && user.Status != model.UserStatusNormal {
		return nil, apperr.New(4003, "请先完成实名认证后再办理入住")
	}
	allowed := order.Status == model.OrderConfirmed ||
		order.Status == model.OrderAwaitingCheckin ||
		order.Status == model.OrderPaid
	if !allowed {
		return nil, apperr.New(4002, "当前订单状态不可办理入住")
	}

	order.Status = model.OrderCheckedIn
	order.CheckedInAt = nowDateTime()
	s.store.SaveOrder(order)
	s.syncRoomByOrder(order, model.RoomOccupied, order.UserID)

	view := order.View()
	return &view, nil
}

// CheckOut 办理退房：已入住 → 已完成，房间转脏房并回收设备控制权。
func (s *Service) CheckOut(user model.User, idOrNo string) (*model.OrderView, error) {
	order, err := s.findOrderOrError(idOrNo)
	if err != nil {
		return nil, err
	}
	if err := ensureOrderAccess(user, order); err != nil {
		return nil, err
	}
	if !model.CanOrderTransition(order.Status, model.OrderCompleted) {
		return nil, apperr.New(4002, orderTransitionMessage(order.Status, model.OrderCompleted))
	}
	order.Status = model.OrderCompleted
	order.CheckedOutAt = nowDateTime()
	s.store.SaveOrder(order)
	s.syncRoomByOrder(order, model.RoomDirty, order.UserID)

	view := order.View()
	return &view, nil
}

// ReviewOrder 评价：已完成 → 已评价，返回订单并携带 review。
func (s *Service) ReviewOrder(user model.User, idOrNo string, rating int, content string) (*model.OrderView, error) {
	order, err := s.findOrderOrError(idOrNo)
	if err != nil {
		return nil, err
	}
	if err := ensureOrderAccess(user, order); err != nil {
		return nil, err
	}
	if !model.CanOrderTransition(order.Status, model.OrderReviewed) {
		return nil, apperr.New(4002, orderTransitionMessage(order.Status, model.OrderReviewed))
	}

	if rating <= 0 {
		rating = 5
	}
	if rating > 5 {
		rating = 5
	}
	userName := user.RealName
	if userName == "" {
		userName = order.GuestName
	}
	review := model.Review{
		ID:        "RV" + strconv.FormatInt(time.Now().UnixNano(), 10),
		OrderID:   order.ID,
		OrderNo:   order.OrderNo,
		RoomID:    order.RoomID,
		RoomNo:    order.RoomNo,
		UserID:    user.ID,
		UserName:  userName,
		Rating:    rating,
		Content:   content,
		CreatedAt: nowDateTime(),
	}
	s.store.AddReview(review)

	order.Status = model.OrderReviewed
	order.ReviewID = review.ID
	s.store.SaveOrder(order)

	view := order.View()
	view.Review = &review
	return &view, nil
}

// OrderTimeline 订单状态时间轴（GET /orders/:id/timeline）。
func (s *Service) OrderTimeline(idOrNo string) ([]model.TimelineStep, error) {
	order, err := s.findOrderOrError(idOrNo)
	if err != nil {
		return nil, err
	}
	steps := []model.TimelineStep{
		{Status: model.OrderPendingPayment, Label: "提交订单", Time: order.CreatedAt},
		{Status: model.OrderPaid, Label: "支付成功", Time: order.PaidAt},
		{Status: model.OrderCheckedIn, Label: "办理入住", Time: order.CheckedInAt},
		{Status: model.OrderCompleted, Label: "退房完成", Time: order.CheckedOutAt},
		{Status: model.OrderReviewed, Label: "已评价", Time: ""},
	}
	if order.ReviewID != "" {
		steps[4].Time = order.CheckedOutAt
	}
	return steps, nil
}

// syncRoomByOrder 订单状态联动房态 + 用户设备控制权（入住绑定 / 退房回收）。
func (s *Service) syncRoomByOrder(order model.Order, roomStatus, ownerID string) {
	room, found := s.store.RoomByID(order.RoomID)
	if !found {
		return
	}
	room.Status = roomStatus
	if roomStatus == model.RoomVacantReady || roomStatus == model.RoomDirty {
		room.CurrentOrderID = ""
		room.GuestName = ""
		room.GuestPhone = ""
		room.CheckInTime = ""
		room.CheckOutTime = ""
	} else {
		room.CurrentOrderID = order.ID
		room.GuestName = order.GuestName
		room.GuestPhone = order.GuestPhone
		room.CheckInTime = order.CheckInTime
		room.CheckOutTime = order.CheckOutTime
	}
	s.store.SaveRoom(room)

	if strings.TrimSpace(ownerID) == "" {
		return
	}
	user, found := s.store.UserByID(ownerID)
	if !found {
		return
	}
	if roomStatus == model.RoomOccupied {
		user.CurrentRoomID = room.ID
		s.store.SaveUser(user)
	}
	if (roomStatus == model.RoomVacantReady || roomStatus == model.RoomDirty) && user.CurrentRoomID == room.ID {
		user.CurrentRoomID = ""
		s.store.SaveUser(user)
	}
}
