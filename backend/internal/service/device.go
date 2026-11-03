package service

import (
	"strings"

	"github.com/smart-home/hotel/backend/internal/model"
	"github.com/smart-home/hotel/backend/internal/pkg/apperr"
)

// QueryDevices 查询设备：
//   - 传 room_id：返回该房间设备数组（C 端控制面板）；
//   - 不传 room_id：返回分页对象（B 端设备运维列表）。
//
// 顾客仅能访问自己当前入住房间的设备。
func (s *Service) QueryDevices(user model.User, roomID, deviceType, onlineStatus, keyword, pageText, pageSizeText string) (any, error) {
	roomID = strings.TrimSpace(roomID)
	keyword = strings.ToLower(strings.TrimSpace(keyword))
	deviceType = strings.TrimSpace(deviceType)
	onlineStatus = strings.TrimSpace(onlineStatus)

	if roomID != "" {
		if _, found := s.store.RoomByID(roomID); !found {
			return nil, apperr.New(404, "房间不存在")
		}
		if user.Role == model.RoleCustomer && user.CurrentRoomID != roomID {
			return nil, apperr.New(4031, "仅可控制当前入住房间设备")
		}
		return s.deviceViews(s.store.DevicesByRoom(roomID)), nil
	}

	filtered := make([]model.Device, 0, len(s.store.Devices()))
	for _, device := range s.store.Devices() {
		if user.Role == model.RoleCustomer && device.RoomID != user.CurrentRoomID {
			continue
		}
		if deviceType != "" && device.Type != deviceType {
			continue
		}
		if onlineStatus != "" && device.OnlineStatus != onlineStatus {
			continue
		}
		if keyword != "" {
			text := strings.ToLower(device.RoomNo + " " + device.SN + " " + device.Name)
			if !strings.Contains(text, keyword) {
				continue
			}
		}
		filtered = append(filtered, device)
	}

	page := parsePositiveInt(pageText, 1)
	pageSize := parsePositiveInt(pageSizeText, 20)
	start := (page - 1) * pageSize
	if start > len(filtered) {
		start = len(filtered)
	}
	end := start + pageSize
	if end > len(filtered) {
		end = len(filtered)
	}

	return model.DeviceListResult{
		List:     s.deviceViews(filtered[start:end]),
		Total:    len(filtered),
		Page:     page,
		PageSize: pageSize,
	}, nil
}

// deviceViews 批量转换设备视图。
func (s *Service) deviceViews(devices []model.Device) []model.DeviceView {
	result := make([]model.DeviceView, 0, len(devices))
	for _, device := range devices {
		result = append(result, device.View())
	}
	return result
}

// DeviceDetail 设备详情。
func (s *Service) DeviceDetail(user model.User, id string) (*model.DeviceView, error) {
	device, found := s.store.DeviceByID(id)
	if !found {
		return nil, apperr.New(404, "设备不存在")
	}
	if err := ensureDeviceAccess(user, device); err != nil {
		return nil, err
	}
	view := device.View()
	return &view, nil
}

// ensureDeviceAccess 顾客只能访问自己当前入住房间的设备（4031）。
func ensureDeviceAccess(user model.User, device model.Device) error {
	if user.Role == model.RoleCustomer && user.CurrentRoomID != device.RoomID {
		return apperr.New(4031, "仅可控制当前入住房间设备")
	}
	return nil
}

// UpdateDeviceProperties 设备属性下发。
//
// 校验链路（与前端 Mock 一致）：
//  1. 设备存在（404）；
//  2. 顾客只能控制当前入住房间设备（4031）；
//  3. 设备离线拒绝下发（5003）；
//  4. 属性必须属于该设备类型（5001 / 5002）；
//  5. 至少有一个属性（5004）。
func (s *Service) UpdateDeviceProperties(user model.User, id string, patch map[string]any) (*model.DeviceView, error) {
	device, found := s.store.DeviceByID(id)
	if !found {
		return nil, apperr.New(404, "设备不存在")
	}
	if err := ensureDeviceAccess(user, device); err != nil {
		return nil, err
	}
	if device.OnlineStatus == model.DeviceOffline {
		return nil, apperr.New(5003, "设备离线，指令下发失败")
	}

	allowedKeys, supported := model.DevicePropertyKeys(device.Type)
	if !supported {
		return nil, apperr.New(5001, "不支持的设备类型："+device.Type)
	}
	if len(patch) == 0 {
		return nil, apperr.New(5004, "缺少要下发的设备属性")
	}
	for key := range patch {
		if !containsPropertyKey(allowedKeys, key) {
			return nil, apperr.New(5002, model.DeviceTypeLabel(device.Type)+"不支持属性 "+key)
		}
	}

	properties := make(map[string]any, len(device.Properties)+len(patch))
	for key, value := range device.Properties {
		properties[key] = value
	}
	for key, value := range patch {
		properties[key] = value
	}
	device.Properties = properties
	device.LastHeartbeat = nowDateTime()
	s.store.SaveDevice(device)

	view := device.View()
	return &view, nil
}

// CheckDevice 设备自检：离线设备返回 5005。
func (s *Service) CheckDevice(user model.User, id string) (*model.DeviceCheckResult, error) {
	device, found := s.store.DeviceByID(id)
	if !found {
		return nil, apperr.New(404, "设备不存在")
	}
	if err := ensureDeviceAccess(user, device); err != nil {
		return nil, err
	}
	device.LastHeartbeat = nowDateTime()
	s.store.SaveDevice(device)
	if device.OnlineStatus == model.DeviceOffline {
		return nil, apperr.New(5005, "设备无响应，请联系工程现场排查")
	}
	return &model.DeviceCheckResult{OK: true, Device: device.View(), Duration: 1.2}, nil
}

// RebindDevice 重新绑定：离线设备恢复上线（工程运维 / 店长）。
func (s *Service) RebindDevice(id string) (*model.DeviceView, error) {
	device, found := s.store.DeviceByID(id)
	if !found {
		return nil, apperr.New(404, "设备不存在")
	}
	device.OnlineStatus = model.DeviceOnline
	device.LastHeartbeat = nowDateTime()
	s.store.SaveDevice(device)

	view := device.View()
	return &view, nil
}

// RefreshDevices 刷新全量设备心跳（演示按钮），返回 {refreshed: n}。
func (s *Service) RefreshDevices() map[string]int {
	count := s.store.RefreshHeartbeats(nowDateTime())
	return map[string]int{"refreshed": count}
}

// containsPropertyKey 判断属性 key 是否在白名单内。
func containsPropertyKey(keys []string, target string) bool {
	for _, key := range keys {
		if key == target {
			return true
		}
	}
	return false
}
