// Package model 定义智慧住家的领域数据模型。
//
// 字段命名与 docs/api-contract.md、docs/architecture.md 以及前端 Mock 数据库
// （frontend/packages/shared-api/src/mock/db.js）完全一致，后续接入 MySQL 时
// 可直接映射为数据表；*View 类型用于附加接口展示字段（status_label 等）。
package model

// ---------------------------------------------------------------------------
// 角色 / 用户状态
// ---------------------------------------------------------------------------

// 系统角色（与前端 shared-utils/constants.js 的 ROLE 一致）。
const (
	RoleCustomer     = "customer"
	RoleStoreManager = "store_manager"
	RoleFrontdesk    = "frontdesk"
	RoleFinance      = "finance"
	RoleEngineer     = "engineer"
)

// 用户 / 实名状态。
const (
	UserStatusNormal     = "normal"
	UserStatusUnverified = "unverified"
	UserStatusDisabled   = "disabled"
)

// IsStaffRole 判断是否为 B 端员工角色。
func IsStaffRole(role string) bool {
	switch role {
	case RoleStoreManager, RoleFrontdesk, RoleFinance, RoleEngineer:
		return true
	}
	return false
}

// ---------------------------------------------------------------------------
// 订单状态机（需求文档 3.1）
// ---------------------------------------------------------------------------

// 订单状态。
const (
	OrderPendingPayment  = "pending_payment"
	OrderPaid            = "paid"
	OrderConfirmed       = "confirmed"
	OrderAwaitingCheckin = "awaiting_checkin"
	OrderCheckedIn       = "checked_in"
	OrderCompleted       = "completed"
	OrderReviewed        = "reviewed"
	OrderCancelled       = "cancelled"
	OrderRefunding       = "refunding"
	OrderRefunded        = "refunded"
)

var orderStatusLabels = map[string]string{
	OrderPendingPayment:  "待支付",
	OrderPaid:            "已支付",
	OrderConfirmed:       "已确认",
	OrderAwaitingCheckin: "待入住",
	OrderCheckedIn:       "已入住",
	OrderCompleted:       "已完成",
	OrderReviewed:        "已评价",
	OrderCancelled:       "已取消",
	OrderRefunding:       "退款中",
	OrderRefunded:        "已退款",
}

// orderTransitions 订单状态流转表（与前端 shared-utils/status-machine.js 一致）。
var orderTransitions = map[string][]string{
	OrderPendingPayment:  {OrderPaid, OrderCancelled},
	OrderPaid:            {OrderConfirmed, OrderRefunding},
	OrderConfirmed:       {OrderAwaitingCheckin, OrderCheckedIn, OrderRefunding},
	OrderAwaitingCheckin: {OrderCheckedIn, OrderRefunding},
	OrderCheckedIn:       {OrderCompleted},
	OrderCompleted:       {OrderReviewed},
	OrderRefunding:       {OrderRefunded},
	OrderReviewed:        {},
	OrderCancelled:       {},
	OrderRefunded:        {},
}

// OrderStatusLabel 返回订单状态中文名（未知状态回退原值）。
func OrderStatusLabel(status string) string {
	if label, ok := orderStatusLabels[status]; ok {
		return label
	}
	return status
}

// CanOrderTransition 判断订单状态流转是否合法（服务端状态机单点校验）。
func CanOrderTransition(from, to string) bool {
	allowed, ok := orderTransitions[from]
	if !ok {
		return false
	}
	for _, item := range allowed {
		if item == to {
			return true
		}
	}
	return false
}

// ---------------------------------------------------------------------------
// 客房房态机（需求文档 3.2）
// ---------------------------------------------------------------------------

// 客房房态。
const (
	RoomVacantReady = "vacant_ready"
	RoomReserved    = "reserved"
	RoomOccupied    = "occupied"
	RoomDirty       = "dirty"
	RoomMaintenance = "maintenance"
)

// RoomStatusOrder 房态枚举顺序（图例 / 饼图按此顺序输出，与前端一致）。
var RoomStatusOrder = []string{RoomVacantReady, RoomReserved, RoomOccupied, RoomDirty, RoomMaintenance}

var roomStatusLabels = map[string]string{
	RoomVacantReady: "可售",
	RoomReserved:    "已预订",
	RoomOccupied:    "已入住",
	RoomDirty:       "脏房",
	RoomMaintenance: "维修中",
}

var roomStatusColors = map[string]string{
	RoomVacantReady: "#52C41A",
	RoomReserved:    "#FAAD14",
	RoomOccupied:    "#F5222D",
	RoomDirty:       "#8C8C8C",
	RoomMaintenance: "#2F54EB",
}

// roomTransitions 房态流转表（与前端 shared-utils/status-machine.js 一致）。
var roomTransitions = map[string][]string{
	RoomVacantReady: {RoomReserved, RoomMaintenance},
	RoomReserved:    {RoomOccupied, RoomVacantReady},
	RoomOccupied:    {RoomDirty},
	RoomDirty:       {RoomVacantReady},
	RoomMaintenance: {RoomVacantReady},
}

// RoomStatusLabel 返回房态中文名。
func RoomStatusLabel(status string) string {
	if label, ok := roomStatusLabels[status]; ok {
		return label
	}
	return status
}

// RoomStatusColor 返回房态配色。
func RoomStatusColor(status string) string {
	return roomStatusColors[status]
}

// IsKnownRoomStatus 判断是否为合法房态枚举。
func IsKnownRoomStatus(status string) bool {
	_, ok := roomStatusLabels[status]
	return ok
}

// CanRoomTransition 判断房态流转是否合法。
func CanRoomTransition(from, to string) bool {
	allowed, ok := roomTransitions[from]
	if !ok {
		return false
	}
	for _, item := range allowed {
		if item == to {
			return true
		}
	}
	return false
}

// StatusLegendItem 房态图例。
type StatusLegendItem struct {
	Status string `json:"status"`
	Label  string `json:"label"`
	Color  string `json:"color"`
}

var roomStatusLegend = []StatusLegendItem{
	{Status: RoomVacantReady, Label: roomStatusLabels[RoomVacantReady], Color: roomStatusColors[RoomVacantReady]},
	{Status: RoomReserved, Label: roomStatusLabels[RoomReserved], Color: roomStatusColors[RoomReserved]},
	{Status: RoomOccupied, Label: roomStatusLabels[RoomOccupied], Color: roomStatusColors[RoomOccupied]},
	{Status: RoomDirty, Label: roomStatusLabels[RoomDirty], Color: roomStatusColors[RoomDirty]},
	{Status: RoomMaintenance, Label: roomStatusLabels[RoomMaintenance], Color: roomStatusColors[RoomMaintenance]},
}

// RoomStatusLegends 返回房态图例副本（避免调用方修改全局数据）。
func RoomStatusLegends() []StatusLegendItem {
	items := make([]StatusLegendItem, len(roomStatusLegend))
	copy(items, roomStatusLegend)
	return items
}

// ---------------------------------------------------------------------------
// 设备（需求文档 4.1.3 / 4.2.3）
// ---------------------------------------------------------------------------

// 设备类型。
const (
	DeviceLight          = "light"
	DeviceAirConditioner = "air_conditioner"
	DeviceCurtain        = "curtain"
	DeviceTV             = "tv"
)

// 设备在线状态。
const (
	DeviceOnline  = "online"
	DeviceOffline = "offline"
)

var deviceTypeLabels = map[string]string{
	DeviceLight:          "灯光",
	DeviceAirConditioner: "空调",
	DeviceCurtain:        "窗帘",
	DeviceTV:             "电视",
}

var deviceOnlineLabels = map[string]string{
	DeviceOnline:  "在线",
	DeviceOffline: "离线",
}

// devicePropertyKeys 设备属性白名单（与前端 DEVICE_PROPERTY_SCHEMA 一致）。
var devicePropertyKeys = map[string][]string{
	DeviceLight:          {"power", "brightness", "color_temp"},
	DeviceAirConditioner: {"power", "mode", "temperature", "fan_speed"},
	DeviceCurtain:        {"open_percent"},
	DeviceTV:             {"power", "volume", "channel"},
}

// DeviceTypeLabel 返回设备类型中文名。
func DeviceTypeLabel(deviceType string) string {
	if label, ok := deviceTypeLabels[deviceType]; ok {
		return label
	}
	return deviceType
}

// DeviceOnlineLabel 返回在线状态中文名。
func DeviceOnlineLabel(onlineStatus string) string {
	if label, ok := deviceOnlineLabels[onlineStatus]; ok {
		return label
	}
	return onlineStatus
}

// DevicePropertyKeys 返回某设备类型支持的属性 key 列表。
func DevicePropertyKeys(deviceType string) ([]string, bool) {
	keys, ok := devicePropertyKeys[deviceType]
	return keys, ok
}

// ---------------------------------------------------------------------------
// 场景（需求文档 4.1.3）
// ---------------------------------------------------------------------------

// 场景编码。
const (
	SceneWelcome = "welcome"
	SceneSleep   = "sleep"
	SceneMovie   = "movie"
	SceneLeave   = "leave"
)

// ---------------------------------------------------------------------------
// 告警（需求文档 4.2.3）
// ---------------------------------------------------------------------------

// 告警状态。
const (
	AlarmPending = "pending"
	AlarmHandled = "handled"
)

// 告警等级。
const (
	AlarmHigh   = "high"
	AlarmMedium = "medium"
	AlarmLow    = "low"
)

var alarmTypeLabels = map[string]string{
	"offline": "设备离线",
	"sos":     "SOS 紧急呼叫",
	"fault":   "设备故障",
}

var alarmLevelLabels = map[string]string{
	AlarmHigh:   "紧急",
	AlarmMedium: "重要",
	AlarmLow:    "一般",
}

// AlarmTypeLabel 返回告警类型中文名。
func AlarmTypeLabel(alarmType string) string {
	if label, ok := alarmTypeLabels[alarmType]; ok {
		return label
	}
	return alarmType
}

// AlarmLevelLabel 返回告警等级中文名。
func AlarmLevelLabel(level string) string {
	if label, ok := alarmLevelLabels[level]; ok {
		return label
	}
	return level
}

// ---------------------------------------------------------------------------
// 升级方案（需求文档 4.3）
// ---------------------------------------------------------------------------

// 方案范围。
const (
	PlanScopeRoom  = "room"
	PlanScopeFloor = "floor"
	PlanScopeStore = "store"
)

// 方案档次。
const (
	PlanTierBasic   = "basic"
	PlanTierComfort = "comfort"
	PlanTierPremium = "premium"
)

// 方案状态。
const (
	PlanDraft           = "draft"
	PlanPendingApproval = "pending_approval"
	PlanApproved        = "approved"
	PlanRejected        = "rejected"
)

var planStatusLabels = map[string]string{
	PlanDraft:           "草稿",
	PlanPendingApproval: "待审批",
	PlanApproved:        "已通过",
	PlanRejected:        "已驳回",
}

// PlanStatusLabel 返回方案状态中文名。
func PlanStatusLabel(status string) string {
	if label, ok := planStatusLabels[status]; ok {
		return label
	}
	return status
}

// ---------------------------------------------------------------------------
// 财务发票
// ---------------------------------------------------------------------------

// 发票状态。
const (
	InvoicePending = "pending"
	InvoiceIssued  = "issued"
)

// ---------------------------------------------------------------------------
// 实体模型
// ---------------------------------------------------------------------------

// Store 门店。
type Store struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Address   string `json:"address"`
	Phone     string `json:"phone"`
	RoomCount int    `json:"room_count"`
}

// RoomType 房型。
type RoomType struct {
	ID          string   `json:"id"`
	StoreID     string   `json:"store_id"`
	Name        string   `json:"name"`
	Price       float64  `json:"price"`
	Area        int      `json:"area"`
	BedType     string   `json:"bed_type"`
	Capacity    int      `json:"capacity"`
	CoverColor  string   `json:"cover_color"`
	Tags        []string `json:"tags"`
	Description string   `json:"description"`
}

// RoomTypeAvailability 可售房型（GET /rooms/availability 列表项）。
type RoomTypeAvailability struct {
	RoomType
	AvailableCount int      `json:"available_count"`
	AvailableRooms []string `json:"available_rooms"`
}

// Room 客房实体。
type Room struct {
	ID             string  `json:"id"`
	StoreID        string  `json:"store_id"`
	RoomNo         string  `json:"room_no"`
	TypeName       string  `json:"type_name"`
	Status         string  `json:"status"`
	RoomTypeID     string  `json:"room_type_id"`
	Price          float64 `json:"price"`
	Floor          int     `json:"floor"`
	GuestName      string  `json:"guest_name"`
	GuestPhone     string  `json:"guest_phone"`
	CheckInTime    string  `json:"check_in_time"`
	CheckOutTime   string  `json:"check_out_time"`
	CurrentOrderID string  `json:"current_order_id"`
	KeyCardNo      string  `json:"key_card_no"`
}

// View 补全房间展示字段（status_label / order_status / order_status_label）。
// orderStatus 为当前关联订单状态，无关联订单时传空字符串。
func (room Room) View(orderStatus string) RoomView {
	return RoomView{
		Room:             room,
		StatusLabel:      RoomStatusLabel(room.Status),
		OrderStatus:      orderStatus,
		OrderStatusLabel: OrderStatusLabel(orderStatus),
	}
}

// RoomView 房间接口视图；GET /rooms/:id 额外携带 devices。
type RoomView struct {
	Room
	StatusLabel      string       `json:"status_label"`
	OrderStatus      string       `json:"order_status"`
	OrderStatusLabel string       `json:"order_status_label"`
	Devices          []DeviceView `json:"devices,omitempty"`
}

// User 用户 / 员工。
type User struct {
	ID            string `json:"id"`
	Phone         string `json:"phone"`
	RealName      string `json:"real_name"`
	IDCard        string `json:"id_card"`
	Status        string `json:"status"`
	Role          string `json:"role"`
	CurrentRoomID string `json:"current_room_id"`
	CreatedAt     string `json:"created_at"`
}

// Order 订单实体。
type Order struct {
	ID           string  `json:"id"`
	OrderNo      string  `json:"order_no"`
	UserID       string  `json:"user_id"`
	RoomID       string  `json:"room_id"`
	RoomTypeID   string  `json:"room_type_id"`
	RoomNo       string  `json:"room_no"`
	TypeName     string  `json:"type_name"`
	Price        float64 `json:"price"`
	Nights       int     `json:"nights"`
	Amount       float64 `json:"amount"`
	Status       string  `json:"status"`
	CheckInTime  string  `json:"check_in_time"`
	CheckOutTime string  `json:"check_out_time"`
	GuestName    string  `json:"guest_name"`
	GuestPhone   string  `json:"guest_phone"`
	CreatedAt    string  `json:"created_at"`
	PaidAt       string  `json:"paid_at"`
	CheckedInAt  string  `json:"checked_in_at"`
	CheckedOutAt string  `json:"checked_out_at"`
	CancelledAt  string  `json:"cancelled_at"`
	RefundReason string  `json:"refund_reason"`
	RefundAt     string  `json:"refund_at"`
	Remark       string  `json:"remark"`
	Source       string  `json:"source"`
	ReviewID     string  `json:"review_id"`
}

// View 补全订单展示字段（status_label / can_control_devices）。
func (order Order) View() OrderView {
	return OrderView{
		Order:             order,
		StatusLabel:       OrderStatusLabel(order.Status),
		CanControlDevices: order.Status == OrderCheckedIn,
	}
}

// OrderView 订单接口视图；评价接口额外携带 review。
type OrderView struct {
	Order
	StatusLabel       string  `json:"status_label"`
	CanControlDevices bool    `json:"can_control_devices"`
	Review            *Review `json:"review,omitempty"`
}

// TimelineStep 订单状态时间轴节点。
type TimelineStep struct {
	Status string `json:"status"`
	Label  string `json:"label"`
	Time   string `json:"time"`
}

// Device 设备实体。
type Device struct {
	ID            string         `json:"id"`
	RoomID        string         `json:"room_id"`
	RoomNo        string         `json:"room_no"`
	SN            string         `json:"sn"`
	Type          string         `json:"type"`
	Name          string         `json:"name"`
	OnlineStatus  string         `json:"online_status"`
	Properties    map[string]any `json:"properties"`
	Firmware      string         `json:"firmware"`
	LastHeartbeat string         `json:"last_heartbeat"`
}

// View 补全设备展示字段（type_label / online_label）。
func (device Device) View() DeviceView {
	return DeviceView{
		Device:      device,
		TypeLabel:   DeviceTypeLabel(device.Type),
		OnlineLabel: DeviceOnlineLabel(device.OnlineStatus),
	}
}

// DeviceView 设备接口视图。
type DeviceView struct {
	Device
	TypeLabel   string `json:"type_label"`
	OnlineLabel string `json:"online_label"`
}

// DeviceCheckResult 设备自检结果（POST /devices/:id/check）。
type DeviceCheckResult struct {
	OK       bool       `json:"ok"`
	Device   DeviceView `json:"device"`
	Duration float64    `json:"duration"`
}

// Review 评价。
type Review struct {
	ID        string `json:"id"`
	OrderID   string `json:"order_id"`
	OrderNo   string `json:"order_no"`
	RoomID    string `json:"room_id"`
	RoomNo    string `json:"room_no"`
	UserID    string `json:"user_id"`
	UserName  string `json:"user_name"`
	Rating    int    `json:"rating"`
	Content   string `json:"content"`
	CreatedAt string `json:"created_at"`
}

// SceneAction 场景动作：{device_type, property, value}。
type SceneAction struct {
	DeviceType string `json:"device_type"`
	Property   string `json:"property"`
	Value      any    `json:"value"`
}

// Scene 预置场景。
type Scene struct {
	ID          string        `json:"id"`
	Code        string        `json:"code"`
	Name        string        `json:"name"`
	Icon        string        `json:"icon"`
	Description string        `json:"description"`
	Actions     []SceneAction `json:"actions"`
}

// SceneExecuted 场景执行结果（POST /scenes/:id/execute）。
type SceneExecuted struct {
	Scene      Scene        `json:"scene"`
	RoomID     string       `json:"room_id"`
	Devices    []DeviceView `json:"devices"`
	ExecutedAt string       `json:"executed_at"`
}

// Alarm 告警。
type Alarm struct {
	ID         string `json:"id"`
	Type       string `json:"type"`
	TypeLabel  string `json:"type_label"`
	Level      string `json:"level"`
	DeviceID   string `json:"device_id"`
	DeviceName string `json:"device_name"`
	RoomID     string `json:"room_id"`
	RoomNo     string `json:"room_no"`
	Status     string `json:"status"`
	CreatedAt  string `json:"created_at"`
	HandledAt  string `json:"handled_at"`
	Handler    string `json:"handler"`
	Content    string `json:"content"`
}

// PlanItem 方案物料清单项。
type PlanItem struct {
	DeviceType string  `json:"device_type"`
	Name       string  `json:"name"`
	Qty        int     `json:"qty"`
	UnitPrice  float64 `json:"unit_price"`
	Amount     float64 `json:"amount"`
}

// Plan 升级方案。
type Plan struct {
	ID         string     `json:"id"`
	Name       string     `json:"name"`
	Scope      string     `json:"scope"`
	ScopeLabel string     `json:"scope_label"`
	ScopeValue int        `json:"scope_value"`
	Tier       string     `json:"tier"`
	TierLabel  string     `json:"tier_label"`
	RoomCount  int        `json:"room_count"`
	Items      []PlanItem `json:"items"`
	TotalPrice float64    `json:"total_price"`
	Status     string     `json:"status"`
	Creator    string     `json:"creator"`
	Approver   string     `json:"approver"`
	Comment    string     `json:"comment"`
	CreatedAt  string     `json:"created_at"`
	ApprovedAt string     `json:"approved_at"`
}

// View 补全方案展示字段（status_label）。
func (plan Plan) View() PlanView {
	return PlanView{Plan: plan, StatusLabel: PlanStatusLabel(plan.Status)}
}

// PlanView 方案接口视图。
type PlanView struct {
	Plan
	StatusLabel string `json:"status_label"`
}

// PlanScopeOption 方案范围选项。
type PlanScopeOption struct {
	Value     string `json:"value"`
	Label     string `json:"label"`
	RoomCount int    `json:"room_count"`
}

// PlanTierOption 方案档次选项。
type PlanTierOption struct {
	Value       string `json:"value"`
	Label       string `json:"label"`
	Description string `json:"description"`
}

// PlanCatalogItem 物料库条目。
type PlanCatalogItem struct {
	DeviceType string  `json:"device_type"`
	Name       string  `json:"name"`
	UnitPrice  float64 `json:"unit_price"`
	QtyPerRoom int     `json:"qty_per_room"`
}

// PlanCatalog 方案物料库（GET /plans/catalog）。
type PlanCatalog struct {
	Scopes []PlanScopeOption            `json:"scopes"`
	Tiers  []PlanTierOption             `json:"tiers"`
	Items  map[string][]PlanCatalogItem `json:"items"`
}

// Invoice 发票 / 对账记录。
type Invoice struct {
	ID        string  `json:"id"`
	OrderID   string  `json:"order_id"`
	OrderNo   string  `json:"order_no"`
	RoomNo    string  `json:"room_no"`
	GuestName string  `json:"guest_name"`
	Amount    float64 `json:"amount"`
	Title     string  `json:"title"`
	TaxNo     string  `json:"tax_no"`
	Status    string  `json:"status"`
	IssuedAt  string  `json:"issued_at"`
	CreatedAt string  `json:"created_at"`
}

// ---------------------------------------------------------------------------
// 看板 / 能耗
// ---------------------------------------------------------------------------

// DashboardOverview 经营看板核心指标。
type DashboardOverview struct {
	Date            string  `json:"date"`
	RoomTotal       int     `json:"room_total"`
	RoomOccupied    int     `json:"room_occupied"`
	RoomReserved    int     `json:"room_reserved"`
	RoomVacant      int     `json:"room_vacant"`
	RoomDirty       int     `json:"room_dirty"`
	RoomMaintenance int     `json:"room_maintenance"`
	OccupancyRate   float64 `json:"occupancy_rate"`
	RevenueToday    float64 `json:"revenue_today"`
	RevenueMonth    float64 `json:"revenue_month"`
	ADR             float64 `json:"adr"`
	GuestCount      int     `json:"guest_count"`
	TodayCheckIn    int     `json:"today_check_in"`
	TodayCheckOut   int     `json:"today_check_out"`
	PendingAlarms   int     `json:"pending_alarms"`
	PendingPlans    int     `json:"pending_plans"`
	AvgRating       float64 `json:"avg_rating"`
	TotalOrders     int     `json:"total_orders"`
}

// DashboardTrendPoint 看板趋势点。
type DashboardTrendPoint struct {
	Date             string  `json:"date"`
	WeekDay          string  `json:"week_day"`
	Revenue          float64 `json:"revenue"`
	OccupancyRate    float64 `json:"occupancy_rate"`
	ADR              float64 `json:"adr"`
	OccupancyPercent float64 `json:"occupancy_percent"`
}

// TrendResult 看板趋势响应（GET /dashboard/trend）。
type TrendResult struct {
	Days int                   `json:"days"`
	List []DashboardTrendPoint `json:"list"`
}

// DistributionItem 房态分布项。
type DistributionItem struct {
	Status  string  `json:"status"`
	Label   string  `json:"label"`
	Color   string  `json:"color"`
	Count   int     `json:"count"`
	Percent float64 `json:"percent"`
}

// DistributionResult 房态分布响应。
type DistributionResult struct {
	List  []DistributionItem `json:"list"`
	Total int                `json:"total"`
}

// EnergyPoint 能耗序列点。
type EnergyPoint struct {
	Date           string  `json:"date"`
	WeekDay        string  `json:"week_day"`
	ElectricityKWh float64 `json:"electricity_kwh"`
	WaterM3        float64 `json:"water_m3"`
	Cost           float64 `json:"cost"`
}

// EnergyTotals 能耗合计。
type EnergyTotals struct {
	ElectricityKWh float64 `json:"electricity_kwh"`
	WaterM3        float64 `json:"water_m3"`
	Cost           float64 `json:"cost"`
}

// EnergySummary 能耗统计响应（GET /energy/summary）。
type EnergySummary struct {
	Days   int           `json:"days"`
	Series []EnergyPoint `json:"series"`
	Totals EnergyTotals  `json:"totals"`
}

// ---------------------------------------------------------------------------
// 列表 / 分页结果
// ---------------------------------------------------------------------------

// OrderListResult 订单分页响应。
type OrderListResult struct {
	List     []OrderView `json:"list"`
	Total    int         `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"page_size"`
}

// DeviceListResult 设备分页响应（GET /devices 不传 room_id 时）。
type DeviceListResult struct {
	List     []DeviceView `json:"list"`
	Total    int          `json:"total"`
	Page     int          `json:"page"`
	PageSize int          `json:"page_size"`
}

// InvoiceListResult 发票分页响应。
type InvoiceListResult struct {
	List     []Invoice `json:"list"`
	Total    int       `json:"total"`
	Page     int       `json:"page"`
	PageSize int       `json:"page_size"`
}

// AlarmListResult 告警列表响应。
type AlarmListResult struct {
	List    []Alarm `json:"list"`
	Total   int     `json:"total"`
	Pending int     `json:"pending"`
}

// PlanListResult 方案列表响应。
type PlanListResult struct {
	List  []PlanView `json:"list"`
	Total int        `json:"total"`
}
