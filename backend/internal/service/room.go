package service

import (
	"sort"
	"strconv"
	"strings"

	"github.com/smart-home/hotel/backend/internal/model"
	"github.com/smart-home/hotel/backend/internal/pkg/apperr"
)

// Stores 门店列表（GET /stores）。
func (s *Service) Stores() []model.Store {
	return s.store.Stores()
}

// RoomTypes 房型列表（GET /room-types?store_id=）。
func (s *Service) RoomTypes(storeID string) []model.RoomType {
	return s.store.RoomTypes(strings.TrimSpace(storeID))
}

// RoomTypeAvailabilityResult 可售房型响应（GET /rooms/availability）。
type RoomTypeAvailabilityResult struct {
	CheckInTime  string                       `json:"check_in_time"`
	CheckOutTime string                       `json:"check_out_time"`
	List         []model.RoomTypeAvailability `json:"list"`
}

// RoomAvailability 按日期查可售房型。
// Mock 阶段按当前 vacant_ready 房态统计，日期参数仅回显（与前端一致）。
func (s *Service) RoomAvailability(checkInTime, checkOutTime string) RoomTypeAvailabilityResult {
	result := RoomTypeAvailabilityResult{
		CheckInTime:  checkInTime,
		CheckOutTime: checkOutTime,
		List:         make([]model.RoomTypeAvailability, 0, 5),
	}
	rooms := s.store.Rooms()
	for _, roomType := range s.store.RoomTypes("") {
		item := model.RoomTypeAvailability{
			RoomType:       roomType,
			AvailableRooms: make([]string, 0),
		}
		for _, room := range rooms {
			if room.RoomTypeID != roomType.ID || room.Status != model.RoomVacantReady {
				continue
			}
			item.AvailableCount++
			item.AvailableRooms = append(item.AvailableRooms, room.RoomNo)
		}
		result.List = append(result.List, item)
	}
	return result
}

// RoomListResult 房态列表响应（GET /rooms）。
type RoomListResult struct {
	List         []model.RoomView         `json:"list"`
	Total        int                      `json:"total"`
	StatusLegend []model.StatusLegendItem `json:"status_legend"`
}

// ListRooms 房态列表：支持门店 / 房态 / 楼层 / 房型 / 关键字过滤，并按房号排序。
func (s *Service) ListRooms(storeID, status, floor, roomTypeID, keyword string) RoomListResult {
	storeID = strings.TrimSpace(storeID)
	if storeID == "" {
		storeID = "ST001"
	}
	keyword = strings.ToLower(strings.TrimSpace(keyword))
	floor = strings.TrimSpace(floor)
	status = strings.TrimSpace(status)
	roomTypeID = strings.TrimSpace(roomTypeID)

	views := make([]model.RoomView, 0, 50)
	for _, room := range s.store.Rooms() {
		if room.StoreID != storeID {
			continue
		}
		if status != "" && room.Status != status {
			continue
		}
		if floor != "" && strconv.Itoa(room.Floor) != floor {
			continue
		}
		if roomTypeID != "" && room.RoomTypeID != roomTypeID {
			continue
		}
		if keyword != "" {
			text := strings.ToLower(room.RoomNo + " " + room.TypeName + " " + room.GuestName)
			if !strings.Contains(text, keyword) {
				continue
			}
		}
		views = append(views, s.roomView(room))
	}
	sort.SliceStable(views, func(i, j int) bool {
		return views[i].RoomNo < views[j].RoomNo
	})
	return RoomListResult{
		List:         views,
		Total:        len(views),
		StatusLegend: model.RoomStatusLegends(),
	}
}

// roomView 组装房间视图（含关联订单状态展示字段）。
func (s *Service) roomView(room model.Room) model.RoomView {
	orderStatus := ""
	if room.CurrentOrderID != "" {
		if order, found := s.store.OrderByIDOrNo(room.CurrentOrderID); found {
			orderStatus = order.Status
		}
	}
	return room.View(orderStatus)
}

// RoomDetail 房间详情（含 devices）。
func (s *Service) RoomDetail(id string) (*model.RoomView, error) {
	room, found := s.store.RoomByID(id)
	if !found {
		return nil, apperr.New(404, "房间不存在")
	}
	view := s.roomView(room)
	devices := s.store.DevicesByRoom(room.ID)
	deviceViews := make([]model.DeviceView, 0, len(devices))
	for _, device := range devices {
		deviceViews = append(deviceViews, device.View())
	}
	view.Devices = deviceViews
	return &view, nil
}

// RoomDevices 房间设备列表（GET /rooms/:id/devices）。
func (s *Service) RoomDevices(id string) ([]model.DeviceView, error) {
	room, found := s.store.RoomByID(id)
	if !found {
		return nil, apperr.New(404, "房间不存在")
	}
	devices := s.store.DevicesByRoom(room.ID)
	result := make([]model.DeviceView, 0, len(devices))
	for _, device := range devices {
		result = append(result, device.View())
	}
	return result, nil
}

// UpdateRoomStatus 前台修改房态：服务端校验房态机。
func (s *Service) UpdateRoomStatus(id, nextStatus string) (*model.RoomView, error) {
	room, found := s.store.RoomByID(id)
	if !found {
		return nil, apperr.New(404, "房间不存在")
	}
	nextStatus = strings.TrimSpace(nextStatus)
	if !model.IsKnownRoomStatus(nextStatus) {
		return nil, apperr.New(2001, "未知房态")
	}
	if nextStatus == room.Status {
		view := s.roomView(room)
		return &view, nil
	}
	if !model.CanRoomTransition(room.Status, nextStatus) {
		return nil, apperr.New(2002, "房态流转不合法："+model.RoomStatusLabel(room.Status)+" → "+model.RoomStatusLabel(nextStatus))
	}
	room = s.applyRoomStatus(room, nextStatus)
	view := s.roomView(room)
	return &view, nil
}

// CleanRoom 保洁完成：脏房 / 维修中 → 可售。
func (s *Service) CleanRoom(id string) (*model.RoomView, error) {
	room, found := s.store.RoomByID(id)
	if !found {
		return nil, apperr.New(404, "房间不存在")
	}
	if room.Status != model.RoomDirty && room.Status != model.RoomMaintenance {
		return nil, apperr.New(2003, "当前房态无需保洁")
	}
	room = s.applyRoomStatus(room, model.RoomVacantReady)
	view := s.roomView(room)
	return &view, nil
}

// MaintenanceRoom 标记维修：仅可售房态可直接转入维修。
func (s *Service) MaintenanceRoom(id string) (*model.RoomView, error) {
	room, found := s.store.RoomByID(id)
	if !found {
		return nil, apperr.New(404, "房间不存在")
	}
	if !model.CanRoomTransition(room.Status, model.RoomMaintenance) {
		return nil, apperr.New(2004, "当前房态 "+model.RoomStatusLabel(room.Status)+" 不能直接转入维修")
	}
	room = s.applyRoomStatus(room, model.RoomMaintenance)
	view := s.roomView(room)
	return &view, nil
}

// applyRoomStatus 写入房态；转为可售 / 脏房时清空住客与关联订单信息（与 Mock setRoomStatus 一致）。
func (s *Service) applyRoomStatus(room model.Room, nextStatus string) model.Room {
	room.Status = nextStatus
	if nextStatus == model.RoomVacantReady || nextStatus == model.RoomDirty {
		room.CurrentOrderID = ""
		room.GuestName = ""
		room.GuestPhone = ""
		room.CheckInTime = ""
		room.CheckOutTime = ""
	}
	s.store.SaveRoom(room)
	return room
}
