package service

import (
	"sort"
	"strings"

	"github.com/smart-home/hotel/backend/internal/model"
	"github.com/smart-home/hotel/backend/internal/pkg/apperr"
)

// ListAlarms 告警列表（GET /alarms?status=&type=&level=）。
func (s *Service) ListAlarms(status, alarmType, level string) model.AlarmListResult {
	status = strings.TrimSpace(status)
	alarmType = strings.TrimSpace(alarmType)
	level = strings.TrimSpace(level)

	list := make([]model.Alarm, 0, len(s.store.Alarms()))
	for _, alarm := range s.store.Alarms() {
		if status != "" && alarm.Status != status {
			continue
		}
		if alarmType != "" && alarm.Type != alarmType {
			continue
		}
		if level != "" && alarm.Level != level {
			continue
		}
		list = append(list, alarm)
	}
	sort.SliceStable(list, func(i, j int) bool {
		return list[i].CreatedAt > list[j].CreatedAt
	})

	pending := 0
	for _, alarm := range list {
		if alarm.Status == model.AlarmPending {
			pending++
		}
	}
	return model.AlarmListResult{List: list, Total: len(list), Pending: pending}
}

// HandleAlarm 处理告警：pending → handled；重复处理返回 7001。
func (s *Service) HandleAlarm(user model.User, id string) (*model.Alarm, error) {
	alarm, found := s.store.AlarmByID(id)
	if !found {
		return nil, apperr.New(404, "告警不存在")
	}
	if alarm.Status == model.AlarmHandled {
		return nil, apperr.New(7001, "该告警已处理")
	}
	alarm.Status = model.AlarmHandled
	alarm.HandledAt = nowDateTime()
	handler := user.RealName
	if handler == "" {
		handler = "值班员工"
	}
	alarm.Handler = handler
	s.store.SaveAlarm(alarm)
	return &alarm, nil
}
