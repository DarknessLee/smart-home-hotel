package service

import (
	"strings"
	"time"

	"github.com/smart-home/hotel/backend/internal/model"
)

// Overview 经营看板核心指标（GET /dashboard/overview）。
func (s *Service) Overview() model.DashboardOverview {
	rooms := s.store.Rooms()
	total := len(rooms)
	counts := make(map[string]int, len(model.RoomStatusOrder))
	for _, room := range rooms {
		counts[room.Status]++
	}

	series := s.store.DashboardSeries()
	latest := model.DashboardTrendPoint{}
	if len(series) > 0 {
		latest = series[len(series)-1]
	}
	revenueMonth := 0.0
	for _, point := range series {
		revenueMonth += point.Revenue
	}

	today := formatDate(time.Now())
	orders := s.store.Orders()
	guestCount := 0
	todayCheckIn := 0
	todayCheckOut := 0
	for _, order := range orders {
		if order.Status == model.OrderCheckedIn {
			guestCount++
		}
		if strings.HasPrefix(order.CheckInTime, today) {
			todayCheckIn++
		}
		if strings.HasPrefix(order.CheckOutTime, today) {
			switch order.Status {
			case model.OrderCheckedIn, model.OrderCompleted, model.OrderReviewed:
				todayCheckOut++
			}
		}
	}

	pendingAlarms := 0
	for _, alarm := range s.store.Alarms() {
		if alarm.Status == model.AlarmPending {
			pendingAlarms++
		}
	}
	pendingPlans := 0
	for _, plan := range s.store.Plans() {
		if plan.Status == model.PlanPendingApproval {
			pendingPlans++
		}
	}

	reviews := s.store.Reviews()
	avgRating := 0.0
	if len(reviews) > 0 {
		sum := 0
		for _, review := range reviews {
			sum += review.Rating
		}
		avgRating = roundTo(float64(sum)/float64(len(reviews)), 2)
	}

	occupancyRate := 0.0
	if total > 0 {
		occupancyRate = roundTo(float64(counts[model.RoomOccupied])/float64(total), 4)
	}

	return model.DashboardOverview{
		Date:            today,
		RoomTotal:       total,
		RoomOccupied:    counts[model.RoomOccupied],
		RoomReserved:    counts[model.RoomReserved],
		RoomVacant:      counts[model.RoomVacantReady],
		RoomDirty:       counts[model.RoomDirty],
		RoomMaintenance: counts[model.RoomMaintenance],
		OccupancyRate:   occupancyRate,
		RevenueToday:    latest.Revenue,
		RevenueMonth:    revenueMonth,
		ADR:             latest.ADR,
		GuestCount:      guestCount,
		TodayCheckIn:    todayCheckIn,
		TodayCheckOut:   todayCheckOut,
		PendingAlarms:   pendingAlarms,
		PendingPlans:    pendingPlans,
		AvgRating:       avgRating,
		TotalOrders:     len(orders),
	}
}

// Trend 营收 / 入住率 / ADR 趋势（GET /dashboard/trend?days=7~30）。
func (s *Service) Trend(daysText string) model.TrendResult {
	series := s.store.DashboardSeries()
	days := clampDays(daysText)
	if days > len(series) {
		days = len(series)
	}
	start := len(series) - days
	if start < 0 {
		start = 0
	}
	list := make([]model.DashboardTrendPoint, 0, days)
	for _, point := range series[start:] {
		point.OccupancyPercent = roundTo(point.OccupancyRate*100, 1)
		list = append(list, point)
	}
	return model.TrendResult{Days: days, List: list}
}

// RoomStatusDistribution 房态分布（GET /dashboard/room-status-distribution）。
func (s *Service) RoomStatusDistribution() model.DistributionResult {
	rooms := s.store.Rooms()
	total := len(rooms)
	counts := make(map[string]int, len(model.RoomStatusOrder))
	for _, room := range rooms {
		counts[room.Status]++
	}

	list := make([]model.DistributionItem, 0, len(model.RoomStatusOrder))
	for _, status := range model.RoomStatusOrder {
		count := counts[status]
		percent := 0.0
		if total > 0 {
			percent = roundTo(float64(count)/float64(total)*100, 1)
		}
		list = append(list, model.DistributionItem{
			Status:  status,
			Label:   model.RoomStatusLabel(status),
			Color:   model.RoomStatusColor(status),
			Count:   count,
			Percent: percent,
		})
	}
	return model.DistributionResult{List: list, Total: total}
}

// EnergySummary 能耗统计（GET /energy/summary?days=7~30）。
func (s *Service) EnergySummary(daysText string) model.EnergySummary {
	energy := s.store.Energy()
	series := energy.Series
	days := clampDays(daysText)
	if days > len(series) {
		days = len(series)
	}
	start := len(series) - days
	if start < 0 {
		start = 0
	}

	points := make([]model.EnergyPoint, 0, days)
	totals := model.EnergyTotals{}
	for _, point := range series[start:] {
		points = append(points, point)
		totals.ElectricityKWh += point.ElectricityKWh
		totals.WaterM3 += point.WaterM3
		totals.Cost += point.Cost
	}
	totals.WaterM3 = roundTo(totals.WaterM3, 1)
	totals.Cost = roundTo(totals.Cost, 2)
	return model.EnergySummary{Days: days, Series: points, Totals: totals}
}
