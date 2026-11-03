package service

import (
	"strings"

	"github.com/smart-home/hotel/backend/internal/model"
	"github.com/smart-home/hotel/backend/internal/pkg/apperr"
)

// Scenes 预置场景列表（GET /scenes）。
func (s *Service) Scenes() []model.Scene {
	return s.store.Scenes()
}

// ExecuteScene 一键执行场景：按 actions 批量写入房间内同类设备属性。
func (s *Service) ExecuteScene(user model.User, sceneID, roomID string) (*model.SceneExecuted, error) {
	scene, found := s.store.SceneByIDOrCode(strings.TrimSpace(sceneID))
	if !found {
		return nil, apperr.New(404, "场景不存在")
	}

	roomID = strings.TrimSpace(roomID)
	if roomID == "" {
		return nil, apperr.New(6001, "缺少 room_id")
	}
	room, found := s.store.RoomByID(roomID)
	if !found {
		return nil, apperr.New(404, "房间不存在")
	}
	if user.Role == model.RoleCustomer && user.CurrentRoomID != room.ID {
		return nil, apperr.New(4031, "仅可控制当前入住房间设备")
	}

	devices := s.store.DevicesByRoom(room.ID)
	for index := range devices {
		updated := false
		for _, action := range scene.Actions {
			if devices[index].Type != action.DeviceType {
				continue
			}
			properties := make(map[string]any, len(devices[index].Properties)+1)
			for key, value := range devices[index].Properties {
				properties[key] = value
			}
			properties[action.Property] = action.Value
			devices[index].Properties = properties
			updated = true
		}
		if updated {
			devices[index].LastHeartbeat = nowDateTime()
			s.store.SaveDevice(devices[index])
		}
	}

	return &model.SceneExecuted{
		Scene:      scene,
		RoomID:     room.ID,
		Devices:    s.deviceViews(devices),
		ExecutedAt: nowISO8601(),
	}, nil
}
