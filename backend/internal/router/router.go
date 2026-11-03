// Package router 注册全部 HTTP 路由。
//
// 路由前缀 /api，路径与 docs/api-contract.md 完全一致，前端关闭 Mock 后可直接联调。
//
// 关于「静态段 + 通配符段」冲突：
// Gin 底层路由树（源自 httprouter）不允许同一层同时存在静态段与通配符参数段，
// 例如 /rooms/availability 与 /rooms/:id 会触发路由注册 panic。
// 为保持对外 URL 与契约完全一致，以下 4 个静态路径复用同层 :id 入口做二次分发：
//
//	GET  /api/rooms/availability        -> GET  /api/rooms/:id（handler 内分发）
//	GET  /api/plans/catalog             -> GET  /api/plans/:id（handler 内分发）
//	POST /api/plans/generate            -> POST /api/plans/:id（handler 内分发）
//	POST /api/devices/refresh           -> POST /api/devices/:id（handler 内分发）
//
// 其余路径均按契约原样注册。
package router

import (
	"github.com/gin-gonic/gin"

	"github.com/smart-home/hotel/backend/internal/config"
	"github.com/smart-home/hotel/backend/internal/handler"
	"github.com/smart-home/hotel/backend/internal/middleware"
	"github.com/smart-home/hotel/backend/internal/pkg/response"
	"github.com/smart-home/hotel/backend/internal/service"
	"github.com/smart-home/hotel/backend/internal/store"
)

// New 构建 Gin 引擎并注册全部路由。
func New(cfg *config.Config, st *store.Store) *gin.Engine {
	if cfg.GinMode != "" {
		gin.SetMode(cfg.GinMode)
	}

	engine := gin.New()
	engine.Use(gin.Recovery())
	engine.Use(middleware.CORS())
	engine.Use(middleware.Logger())
	engine.NoRoute(func(c *gin.Context) {
		response.Fail(c, 404, "接口不存在")
	})

	h := handler.New(service.New(st))

	// 根路径健康检查（容器探针）
	engine.GET("/health", h.Health)

	api := engine.Group("/api")

	// ------------------------------------------------------------------
	// 公开接口（与前端 Mock 一致：浏览类接口无需登录）
	// ------------------------------------------------------------------
	api.GET("/health", h.Health)
	api.POST("/auth/login", h.Login)
	api.POST("/auth/staff-login", h.StaffLogin)
	api.POST("/auth/logout", h.Logout)
	api.GET("/auth/demo-accounts", h.DemoAccounts)
	api.GET("/auth/me", middleware.OptionalAuth(st), h.Me)
	api.GET("/stores", h.Stores)
	api.GET("/room-types", h.RoomTypes)
	api.GET("/rooms", h.Rooms)
	api.GET("/rooms/:id", h.RoomDetailOrAvailability) // /rooms/availability 由该入口分发
	api.GET("/rooms/:id/devices", h.RoomDevices)
	api.GET("/scenes", h.ListScenes)
	api.GET("/plans/:id", h.PlanDetailOrCatalog) // /plans/catalog 由该入口分发

	// ------------------------------------------------------------------
	// 需要登录的接口
	// ------------------------------------------------------------------
	authed := api.Group("", middleware.Auth(st))

	// 认证 / 实名
	authed.GET("/auth/profile", h.Profile)
	authed.POST("/auth/real-name", h.RealName)

	// 客房房态操作（前台 / 店长）
	roomOperate := middleware.Require(middleware.PermissionBRoomOperate)
	authed.PATCH("/rooms/:id/status", roomOperate, h.UpdateRoomStatus)
	authed.POST("/rooms/:id/clean", roomOperate, h.CleanRoom)
	authed.POST("/rooms/:id/maintenance", roomOperate, h.MaintenanceRoom)

	// 订单：顾客（自己的订单）/ 前台、店长（订单运营）/ 财务（查看）
	orderView := middleware.Require(middleware.PermissionCOrderOwn, middleware.PermissionBOrderView)
	orderOperate := middleware.Require(middleware.PermissionCOrderOwn, middleware.PermissionBOrderOperate)
	authed.POST("/orders", orderOperate, h.CreateOrder)
	authed.GET("/orders", orderView, h.ListOrders)
	authed.GET("/orders/:id", orderView, h.OrderDetail)
	authed.GET("/orders/:id/timeline", orderView, h.OrderTimeline)
	authed.POST("/orders/:id/pay", orderOperate, h.PayOrder)
	authed.POST("/orders/:id/cancel", orderOperate, h.CancelOrder)
	authed.POST("/orders/:id/refund", orderOperate, h.RefundOrder)
	authed.POST("/orders/:id/refund/confirm", middleware.Require(middleware.PermissionBOrderOperate), h.ConfirmRefund)
	authed.POST("/orders/:id/check-in", orderOperate, h.CheckInOrder)
	authed.POST("/orders/:id/check-out", orderOperate, h.CheckOutOrder)
	authed.POST("/orders/:id/review", orderOperate, h.ReviewOrder)

	// 设备：顾客（当前入住房间）/ 前台（查看）/ 运维、店长（全局控制）
	deviceView := middleware.Require(middleware.PermissionCDeviceOwnRoom, middleware.PermissionBDeviceView)
	deviceOperate := middleware.Require(middleware.PermissionCDeviceOwnRoom, middleware.PermissionBDeviceOperate)
	authed.GET("/devices", deviceView, h.ListDevices)
	authed.GET("/devices/:id", deviceView, h.DeviceDetail)
	authed.PATCH("/devices/:id/properties", deviceOperate, h.UpdateDeviceProperties)
	authed.POST("/devices/:id/check", deviceOperate, h.CheckDevice)
	authed.POST("/devices/:id/rebind", middleware.Require(middleware.PermissionBDeviceOperate), h.RebindDevice)
	authed.POST("/devices/:id", middleware.Require(middleware.PermissionBDeviceView), h.DeviceRefreshOrNotFound) // /devices/refresh 由该入口分发

	// 场景：顾客（当前入住房间）/ 运维、店长
	authed.POST("/scenes/:id/execute",
		middleware.Require(middleware.PermissionCSceneOwnRoom, middleware.PermissionBDeviceOperate),
		h.ExecuteScene,
	)

	// 看板 / 能耗
	dashboardView := middleware.Require(middleware.PermissionBDashboardView)
	authed.GET("/dashboard/overview", dashboardView, h.DashboardOverview)
	authed.GET("/dashboard/trend", dashboardView, h.DashboardTrend)
	authed.GET("/dashboard/room-status-distribution", dashboardView, h.RoomStatusDistribution)
	authed.GET("/energy/summary", middleware.Require(middleware.PermissionBEnergyView), h.EnergySummary)

	// 告警中心
	authed.GET("/alarms", middleware.Require(middleware.PermissionBAlarmView), h.ListAlarms)
	authed.POST("/alarms/:id/handle", middleware.Require(middleware.PermissionBAlarmHandle), h.HandleAlarm)

	// 升级方案（方案审批仅店长：RBAC 拦截返回 403）
	authed.GET("/plans", middleware.Require(middleware.PermissionBPlanView), h.ListPlans)
	authed.POST("/plans/:id", middleware.Require(middleware.PermissionBPlanCreate), h.PlanGenerateOrNotFound) // /plans/generate 由该入口分发
	authed.POST("/plans/:id/submit", middleware.Require(middleware.PermissionBPlanCreate), h.SubmitPlan)
	authed.POST("/plans/:id/approve", middleware.Require(middleware.PermissionBPlanApprove), h.ApprovePlan)

	// 财务对账 / 发票
	authed.GET("/invoices", middleware.Require(middleware.PermissionBFinanceView), h.ListInvoices)
	authed.POST("/invoices/:id/issue", middleware.Require(middleware.PermissionBFinanceOp), h.IssueInvoice)

	return engine
}
