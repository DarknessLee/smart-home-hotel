package store

import (
	"fmt"
	"math"
	"strconv"
	"sync"
	"time"

	"github.com/smart-home/hotel/backend/internal/model"
)

// Store 内存数据仓库（MVP 阶段的「可运行数据库」）。
//
// 并发安全：所有导出方法均使用 sync.RWMutex 保护；读操作返回实体副本，
// 写操作通过 SaveXxx 覆盖切片元素，避免调用方直接修改仓库内部数据。
//
// 后期替换点：
//   - MySQL：保持本文件导出的方法签名，新增 mysql.go 实现同一接口/结构体；
//   - Redis：登录态、设备属性缓存可下沉到 Redis；
//   - 种子数据（seed）在真实数据库中改为迁移脚本 / 初始化 SQL。
type Store struct {
	mu              sync.RWMutex
	idSeq           uint64
	stores          []model.Store
	roomTypes       []model.RoomType
	rooms           []model.Room
	users           []model.User
	devices         []model.Device
	scenes          []model.Scene
	orders          []model.Order
	alarms          []model.Alarm
	reviews         []model.Review
	invoices        []model.Invoice
	plans           []model.Plan
	planCatalog     model.PlanCatalog
	energy          model.EnergySummary
	dashboardSeries []model.DashboardTrendPoint
}

// NewMemoryStore 创建内存仓库并写入确定性演示数据。
func NewMemoryStore() *Store {
	instance := &Store{}
	instance.seed()
	return instance
}

// nextInternalID 生成内部唯一 ID（种子数据与运行时新建实体共用）。
func (s *Store) nextInternalID(prefix string) string {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.idSeq++
	return fmt.Sprintf("%s_%d_%d", prefix, time.Now().UnixMilli(), s.idSeq)
}

// ---------------------------------------------------------------------------
// 门店 / 房型
// ---------------------------------------------------------------------------

// Stores 返回门店列表。
func (s *Store) Stores() []model.Store {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]model.Store, len(s.stores))
	copy(result, s.stores)
	return result
}

// RoomTypes 返回房型列表；storeID 为空时返回全部。
func (s *Store) RoomTypes(storeID string) []model.RoomType {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]model.RoomType, 0, len(s.roomTypes))
	for _, roomType := range s.roomTypes {
		if storeID != "" && roomType.StoreID != storeID {
			continue
		}
		result = append(result, roomType)
	}
	return result
}

// ---------------------------------------------------------------------------
// 客房
// ---------------------------------------------------------------------------

// Rooms 返回全部客房副本。
func (s *Store) Rooms() []model.Room {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]model.Room, len(s.rooms))
	copy(result, s.rooms)
	return result
}

// RoomByID 按房间 id 查询。
func (s *Store) RoomByID(id string) (model.Room, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, room := range s.rooms {
		if room.ID == id {
			return room, true
		}
	}
	return model.Room{}, false
}

// SaveRoom 覆盖保存房间（按 id 匹配）。
func (s *Store) SaveRoom(room model.Room) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for index := range s.rooms {
		if s.rooms[index].ID == room.ID {
			s.rooms[index] = room
			return
		}
	}
}

// ---------------------------------------------------------------------------
// 用户
// ---------------------------------------------------------------------------

// Users 返回全部用户副本。
func (s *Store) Users() []model.User {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]model.User, len(s.users))
	copy(result, s.users)
	return result
}

// UserByID 按用户 id 查询。
func (s *Store) UserByID(id string) (model.User, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, user := range s.users {
		if user.ID == id {
			return user, true
		}
	}
	return model.User{}, false
}

// UserByPhone 按手机号查询。
func (s *Store) UserByPhone(phone string) (model.User, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, user := range s.users {
		if user.Phone == phone {
			return user, true
		}
	}
	return model.User{}, false
}

// AddUser 新增用户。
func (s *Store) AddUser(user model.User) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.users = append(s.users, user)
}

// SaveUser 覆盖保存用户（按 id 匹配）。
func (s *Store) SaveUser(user model.User) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for index := range s.users {
		if s.users[index].ID == user.ID {
			s.users[index] = user
			return
		}
	}
}

// ---------------------------------------------------------------------------
// 设备
// ---------------------------------------------------------------------------

// Devices 返回全部设备副本。
func (s *Store) Devices() []model.Device {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]model.Device, len(s.devices))
	copy(result, s.devices)
	return result
}

// DeviceByID 按设备 id 查询。
func (s *Store) DeviceByID(id string) (model.Device, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, device := range s.devices {
		if device.ID == id {
			return device, true
		}
	}
	return model.Device{}, false
}

// DevicesByRoom 返回某房间的全部设备。
func (s *Store) DevicesByRoom(roomID string) []model.Device {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]model.Device, 0, 4)
	for _, device := range s.devices {
		if device.RoomID == roomID {
			result = append(result, device)
		}
	}
	return result
}

// SaveDevice 覆盖保存设备（按 id 匹配）。
func (s *Store) SaveDevice(device model.Device) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for index := range s.devices {
		if s.devices[index].ID == device.ID {
			s.devices[index] = device
			return
		}
	}
}

// RefreshHeartbeats 刷新全部设备心跳，返回刷新数量（POST /devices/refresh）。
func (s *Store) RefreshHeartbeats(at string) int {
	s.mu.Lock()
	defer s.mu.Unlock()
	for index := range s.devices {
		s.devices[index].LastHeartbeat = at
	}
	return len(s.devices)
}

// ---------------------------------------------------------------------------
// 场景
// ---------------------------------------------------------------------------

// Scenes 返回预置场景副本。
func (s *Store) Scenes() []model.Scene {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]model.Scene, len(s.scenes))
	copy(result, s.scenes)
	return result
}

// SceneByIDOrCode 按场景 id 或 code 查询。
func (s *Store) SceneByIDOrCode(idOrCode string) (model.Scene, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, scene := range s.scenes {
		if scene.ID == idOrCode || scene.Code == idOrCode {
			return scene, true
		}
	}
	return model.Scene{}, false
}

// ---------------------------------------------------------------------------
// 订单
// ---------------------------------------------------------------------------

// Orders 返回全部订单副本。
func (s *Store) Orders() []model.Order {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]model.Order, len(s.orders))
	copy(result, s.orders)
	return result
}

// OrderByIDOrNo 按订单 id 或订单号查询（GET /orders/:id 支持两者）。
func (s *Store) OrderByIDOrNo(idOrNo string) (model.Order, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, order := range s.orders {
		if order.ID == idOrNo || order.OrderNo == idOrNo {
			return order, true
		}
	}
	return model.Order{}, false
}

// AddOrder 新增订单。
func (s *Store) AddOrder(order model.Order) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.orders = append(s.orders, order)
}

// SaveOrder 覆盖保存订单（按 id 匹配）。
func (s *Store) SaveOrder(order model.Order) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for index := range s.orders {
		if s.orders[index].ID == order.ID {
			s.orders[index] = order
			return
		}
	}
}

// NextOrderNo 生成订单号：ORD + YYYYMMDD + 3 位流水（与前端 Mock 规则一致）。
func (s *Store) NextOrderNo(now time.Time) string {
	s.mu.RLock()
	seq := len(s.orders) + 1
	s.mu.RUnlock()
	return fmt.Sprintf("ORD%s%03d", now.Format("20060102"), seq)
}

// ---------------------------------------------------------------------------
// 评价
// ---------------------------------------------------------------------------

// Reviews 返回全部评价副本。
func (s *Store) Reviews() []model.Review {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]model.Review, len(s.reviews))
	copy(result, s.reviews)
	return result
}

// AddReview 新增评价（最新的排在最前，与 Mock unshift 行为一致）。
func (s *Store) AddReview(review model.Review) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.reviews = append([]model.Review{review}, s.reviews...)
}

// ---------------------------------------------------------------------------
// 告警
// ---------------------------------------------------------------------------

// Alarms 返回全部告警副本。
func (s *Store) Alarms() []model.Alarm {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]model.Alarm, len(s.alarms))
	copy(result, s.alarms)
	return result
}

// AlarmByID 按告警 id 查询。
func (s *Store) AlarmByID(id string) (model.Alarm, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, alarm := range s.alarms {
		if alarm.ID == id {
			return alarm, true
		}
	}
	return model.Alarm{}, false
}

// SaveAlarm 覆盖保存告警（按 id 匹配）。
func (s *Store) SaveAlarm(alarm model.Alarm) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for index := range s.alarms {
		if s.alarms[index].ID == alarm.ID {
			s.alarms[index] = alarm
			return
		}
	}
}

// ---------------------------------------------------------------------------
// 发票
// ---------------------------------------------------------------------------

// Invoices 返回全部发票副本。
func (s *Store) Invoices() []model.Invoice {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]model.Invoice, len(s.invoices))
	copy(result, s.invoices)
	return result
}

// InvoiceByID 按发票 id 查询。
func (s *Store) InvoiceByID(id string) (model.Invoice, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, invoice := range s.invoices {
		if invoice.ID == id {
			return invoice, true
		}
	}
	return model.Invoice{}, false
}

// SaveInvoice 覆盖保存发票（按 id 匹配）。
func (s *Store) SaveInvoice(invoice model.Invoice) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for index := range s.invoices {
		if s.invoices[index].ID == invoice.ID {
			s.invoices[index] = invoice
			return
		}
	}
}

// ---------------------------------------------------------------------------
// 升级方案
// ---------------------------------------------------------------------------

// PlanCatalog 返回方案物料库。
func (s *Store) PlanCatalog() model.PlanCatalog {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.planCatalog
}

// Plans 返回全部方案副本。
func (s *Store) Plans() []model.Plan {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]model.Plan, len(s.plans))
	copy(result, s.plans)
	return result
}

// PlanByID 按方案 id 查询。
func (s *Store) PlanByID(id string) (model.Plan, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, plan := range s.plans {
		if plan.ID == id {
			return plan, true
		}
	}
	return model.Plan{}, false
}

// AddPlanFront 新增方案并置于列表首位（GET /plans 按创建时间倒序展示）。
func (s *Store) AddPlanFront(plan model.Plan) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.plans = append([]model.Plan{plan}, s.plans...)
}

// SavePlan 覆盖保存方案（按 id 匹配）。
func (s *Store) SavePlan(plan model.Plan) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for index := range s.plans {
		if s.plans[index].ID == plan.ID {
			s.plans[index] = plan
			return
		}
	}
}

// BuildPlanDraft 按「范围 + 档次」生成方案草稿。
// 种子数据（PLAN_1001~1003）与 POST /plans/generate 共用同一套物料规则。
func (s *Store) BuildPlanDraft(scope, tier string) model.Plan {
	s.mu.RLock()
	catalog := s.planCatalog
	s.mu.RUnlock()

	if len(catalog.Scopes) == 0 || len(catalog.Tiers) == 0 {
		return model.Plan{}
	}

	scopeOption := catalog.Scopes[0]
	for _, option := range catalog.Scopes {
		if option.Value == scope {
			scopeOption = option
			break
		}
	}
	tierOption := catalog.Tiers[0]
	for _, option := range catalog.Tiers {
		if option.Value == tier {
			tierOption = option
			break
		}
	}
	catalogItems := catalog.Items[tierOption.Value]
	if len(catalogItems) == 0 {
		catalogItems = catalog.Items[model.PlanTierBasic]
	}

	items := make([]model.PlanItem, 0, len(catalogItems))
	totalPrice := 0.0
	for _, item := range catalogItems {
		qty := item.QtyPerRoom * scopeOption.RoomCount
		amount := float64(qty) * item.UnitPrice
		items = append(items, model.PlanItem{
			DeviceType: item.DeviceType,
			Name:       item.Name,
			Qty:        qty,
			UnitPrice:  item.UnitPrice,
			Amount:     amount,
		})
		totalPrice += amount
	}

	return model.Plan{
		ID:         s.nextInternalID("PLAN"),
		Name:       tierOption.Label + " · " + scopeOption.Label,
		Scope:      scopeOption.Value,
		ScopeLabel: scopeOption.Label,
		ScopeValue: scopeOption.RoomCount,
		Tier:       tierOption.Value,
		TierLabel:  tierOption.Label,
		RoomCount:  scopeOption.RoomCount,
		Items:      items,
		TotalPrice: totalPrice,
		Status:     model.PlanDraft,
		Creator:    "王经理",
		CreatedAt:  formatDateTime(time.Now()),
	}
}

// ---------------------------------------------------------------------------
// 统计序列（看板 / 能耗）
// ---------------------------------------------------------------------------

// DashboardSeries 返回看板趋势序列副本。
func (s *Store) DashboardSeries() []model.DashboardTrendPoint {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]model.DashboardTrendPoint, len(s.dashboardSeries))
	copy(result, s.dashboardSeries)
	return result
}

// Energy 返回能耗数据副本（序列切片与仓库共享底层数组，仅读场景使用）。
func (s *Store) Energy() model.EnergySummary {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.energy
}

// ---------------------------------------------------------------------------
// 种子数据（对应 frontend/packages/shared-api/src/mock/db.js）
// 使用固定种子的线性同余伪随机数，保证每次启动数据一致、图表视觉稳定。
// ---------------------------------------------------------------------------

// seedOrderInput 种子订单入参。
type seedOrderInput struct {
	RoomID       string
	UserID       string
	GuestName    string
	GuestPhone   string
	Status       string
	FinalStatus  string
	CheckInAt    time.Time
	CheckOutAt   time.Time
	PaidAt       string
	CheckedOutAt string
	CancelledAt  string
	RefundReason string
}

// seed 生成全部演示数据（门店 / 房型 / 客房 / 用户 / 订单 / 设备 / 场景 / 告警 / 方案 / 发票 / 30 天序列）。
func (s *Store) seed() {
	today := startOfToday()
	rng := newSeedRNG(20261021)

	// 1. 门店
	s.stores = []model.Store{{
		ID:        "ST001",
		Name:      "智慧住家·未来城旗舰店",
		Address:   "滨江市未来城科技大道 88 号",
		Phone:     "0571-8888 6666",
		RoomCount: 50,
	}}

	// 2. 房型（¥399 ~ ¥999）
	s.roomTypes = []model.RoomType{
		{ID: "RT01", StoreID: "ST001", Name: "轻享大床房", Price: 399, Area: 28, BedType: "1.8m 大床", Capacity: 2, CoverColor: "#5B8DEF", Tags: []string{"智能灯光", "电动窗帘", "免费早餐"}, Description: "28㎡ 舒适空间，配电动窗帘与全屋智能灯光，一键切换入住 / 睡眠场景。"},
		{ID: "RT02", StoreID: "ST001", Name: "悦享双床房", Price: 459, Area: 32, BedType: "1.2m 双床", Capacity: 2, CoverColor: "#36CFC9", Tags: []string{"双床", "智能空调", "高速 WiFi"}, Description: "32㎡ 双床房，适合朋友出行，空调与灯光支持语音与面板双控。"},
		{ID: "RT03", StoreID: "ST001", Name: "亲子家庭房", Price: 599, Area: 45, BedType: "1.8m 大床 + 1.2m 儿童床", Capacity: 3, CoverColor: "#FFA940", Tags: []string{"亲子主题", "儿童洗漱台", "智能安防"}, Description: "45㎡ 家庭房，儿童友好设计，配备智能安防与一键睡眠场景。"},
		{ID: "RT04", StoreID: "ST001", Name: "巨幕影音房", Price: 699, Area: 38, BedType: "2.0m 大床", Capacity: 2, CoverColor: "#9254DE", Tags: []string{"120 寸巨幕", "环绕音响", "观影场景"}, Description: "38㎡ 影音主题房，一键观影场景自动熄灯、拉帘、开启巨幕。"},
		{ID: "RT05", StoreID: "ST001", Name: "行政套房", Price: 999, Area: 60, BedType: "2.0m 大床", Capacity: 2, CoverColor: "#F759AB", Tags: []string{"独立客厅", "智能管家", "行政酒廊"}, Description: "60㎡ 行政套房，独立客厅 + 智能管家，覆盖全屋十二路智能设备。"},
	}

	// 3. 客房：楼层 3~7，每层 10 间，房号 301~310 / 401~410 ... 701~710
	// 房态模式：确保 5 种房态均覆盖（可售 / 已预订 / 已入住 / 脏房 / 维修中）
	roomStatusPattern := []string{
		model.RoomOccupied,
		model.RoomOccupied,
		model.RoomVacantReady,
		model.RoomReserved,
		model.RoomOccupied,
		model.RoomDirty,
		model.RoomVacantReady,
		model.RoomMaintenance,
		model.RoomVacantReady,
		model.RoomReserved,
	}
	s.rooms = make([]model.Room, 0, 50)
	for floor := 3; floor <= 7; floor++ {
		for index := 1; index <= 10; index++ {
			seq := (floor-3)*10 + (index - 1)
			// 房型按 (seq + seq/10) 轮转：与房态模式组合后保证 5 种房型都有可售房，
			// 便于联调 docs/api-contract.md 11.1 中「选择 RT01 下单」的示例链路。
			roomType := s.roomTypes[(seq+seq/10)%len(s.roomTypes)]
			roomNo := strconv.Itoa(floor) + pad2(index)
			s.rooms = append(s.rooms, model.Room{
				ID:         "R" + roomNo,
				StoreID:    "ST001",
				RoomNo:     roomNo,
				TypeName:   roomType.Name,
				RoomTypeID: roomType.ID,
				Price:      roomType.Price,
				Status:     roomStatusPattern[seq%len(roomStatusPattern)],
				Floor:      floor,
			})
		}
	}

	// 4. 用户：演示顾客 U1000（已实名、已入住 R305）+ 4 名员工
	s.users = []model.User{
		{ID: "U1000", Phone: "13800138000", RealName: "张小明", IDCard: "330106199003075678", Status: model.UserStatusNormal, Role: model.RoleCustomer, CurrentRoomID: "R305", CreatedAt: formatDateTime(today.AddDate(0, 0, -90))},
		{ID: "ST1001", Phone: "13900000001", RealName: "王经理", Status: model.UserStatusNormal, Role: model.RoleStoreManager, CreatedAt: formatDateTime(today.AddDate(0, 0, -400))},
		{ID: "ST1002", Phone: "13900000002", RealName: "李前台", Status: model.UserStatusNormal, Role: model.RoleFrontdesk, CreatedAt: formatDateTime(today.AddDate(0, 0, -300))},
		{ID: "ST1003", Phone: "13900000003", RealName: "赵会计", Status: model.UserStatusNormal, Role: model.RoleFinance, CreatedAt: formatDateTime(today.AddDate(0, 0, -250))},
		{ID: "ST1004", Phone: "13900000004", RealName: "孙工", Status: model.UserStatusNormal, Role: model.RoleEngineer, CreatedAt: formatDateTime(today.AddDate(0, 0, -200))},
	}
	demoUser := s.users[0]

	// 5. 订单：演示顾客覆盖主要状态节点
	// 已入住（当前可控制 R305 设备）
	s.seedOrder(seedOrderInput{
		RoomID:     "R305",
		UserID:     demoUser.ID,
		Status:     model.OrderCheckedIn,
		CheckInAt:  today.AddDate(0, 0, -1).Add(14 * time.Hour),
		CheckOutAt: today.AddDate(0, 0, 2).Add(12 * time.Hour),
		PaidAt:     formatDateTime(today.AddDate(0, 0, -2).Add(10 * time.Hour)),
	})
	// 待支付（R303 等待顾客支付）
	s.seedOrder(seedOrderInput{
		RoomID:     "R303",
		UserID:     demoUser.ID,
		Status:     model.OrderPendingPayment,
		CheckInAt:  today.AddDate(0, 0, 1).Add(14 * time.Hour),
		CheckOutAt: today.AddDate(0, 0, 3).Add(12 * time.Hour),
	})
	// 已取消（R307 维持可售）
	s.seedOrder(seedOrderInput{
		RoomID:      "R307",
		UserID:      demoUser.ID,
		Status:      model.OrderPendingPayment,
		FinalStatus: model.OrderCancelled,
		CheckInAt:   today.AddDate(0, 0, -2).Add(14 * time.Hour),
		CheckOutAt:  today.AddDate(0, 0, -1).Add(12 * time.Hour),
		CancelledAt: formatDateTime(today.AddDate(0, 0, -3).Add(9 * time.Hour)),
	})
	// 已评价（R409 历史订单，房间转脏房）
	reviewedOrder := s.seedOrder(seedOrderInput{
		RoomID:       "R409",
		UserID:       demoUser.ID,
		Status:       model.OrderCompleted,
		FinalStatus:  model.OrderReviewed,
		CheckInAt:    today.AddDate(0, 0, -8).Add(14 * time.Hour),
		CheckOutAt:   today.AddDate(0, 0, -6).Add(12 * time.Hour),
		CheckedOutAt: formatDateTime(today.AddDate(0, 0, -6).Add(12 * time.Hour)),
	})
	// 退款中（其他客人 R507，房态保留预订单）
	refundingOrder := s.seedOrder(seedOrderInput{
		RoomID:       "R507",
		UserID:       "U2001",
		GuestName:    "钱女士",
		GuestPhone:   "13700001111",
		Status:       model.OrderRefunding,
		CheckInAt:    today.AddDate(0, 0, 4).Add(14 * time.Hour),
		CheckOutAt:   today.AddDate(0, 0, 6).Add(12 * time.Hour),
		RefundReason: "行程变更，申请取消预订",
	})
	if room, ok := s.RoomByID("R507"); ok {
		room.Status = model.RoomReserved
		room.GuestName = refundingOrder.GuestName
		room.GuestPhone = refundingOrder.GuestPhone
		room.CheckInTime = refundingOrder.CheckInTime
		room.CheckOutTime = refundingOrder.CheckOutTime
		room.CurrentOrderID = refundingOrder.ID
		s.SaveRoom(room)
	}

	// 其他客房的进行中 / 历史订单（让 B 端订单列表与看板有数据）
	guestNames := []string{
		"张伟", "王芳", "李娜", "刘洋", "陈静", "杨帆", "赵磊", "周敏", "吴强", "徐丽",
		"孙涛", "马超", "朱琳", "胡军", "郭敏", "何平", "林峰", "高源", "罗静", "梁宇",
		"宋佳", "谢东", "韩雪", "唐杰", "冯雪", "邓超", "曹阳", "彭博", "曾丽", "苏航",
	}
	usedRooms := map[string]bool{"R303": true, "R305": true, "R307": true, "R409": true, "R507": true}
	guestSeq := 0
	nextGuest := func() model.User {
		guest := model.User{
			ID:       fmt.Sprintf("U%d", 2000+guestSeq),
			Phone:    guestPhone(guestSeq),
			RealName: guestNames[guestSeq%len(guestNames)],
		}
		guestSeq++
		return guest
	}
	for _, room := range s.Rooms() {
		if usedRooms[room.ID] {
			continue
		}
		guest := nextGuest()
		switch room.Status {
		case model.RoomOccupied:
			s.seedOrder(seedOrderInput{
				RoomID:     room.ID,
				UserID:     guest.ID,
				GuestName:  guest.RealName,
				GuestPhone: guest.Phone,
				Status:     model.OrderCheckedIn,
				CheckInAt:  today.AddDate(0, 0, -rng.randomInt(1, 3)).Add(14 * time.Hour),
				CheckOutAt: today.AddDate(0, 0, rng.randomInt(1, 4)).Add(12 * time.Hour),
			})
		case model.RoomReserved:
			status := model.OrderConfirmed
			if rng.random() > 0.5 {
				status = model.OrderAwaitingCheckin
			}
			s.seedOrder(seedOrderInput{
				RoomID:     room.ID,
				UserID:     guest.ID,
				GuestName:  guest.RealName,
				GuestPhone: guest.Phone,
				Status:     status,
				CheckInAt:  today.AddDate(0, 0, rng.randomInt(1, 5)).Add(14 * time.Hour),
				CheckOutAt: today.AddDate(0, 0, rng.randomInt(6, 9)).Add(12 * time.Hour),
			})
		case model.RoomDirty:
			s.seedOrder(seedOrderInput{
				RoomID:       room.ID,
				UserID:       guest.ID,
				GuestName:    guest.RealName,
				GuestPhone:   guest.Phone,
				Status:       model.OrderCompleted,
				CheckInAt:    today.AddDate(0, 0, -rng.randomInt(2, 6)).Add(14 * time.Hour),
				CheckOutAt:   today.AddDate(0, 0, -1).Add(12 * time.Hour),
				CheckedOutAt: formatDateTime(today.AddDate(0, 0, -1).Add(12 * time.Hour)),
			})
		}
	}

	// 补充 paid / refunded 两种状态，保证 10 种订单状态全覆盖
	if roomID := firstVacantRoomID(s.Rooms(), usedRooms); roomID != "" {
		guest := nextGuest()
		s.seedOrder(seedOrderInput{
			RoomID:     roomID,
			UserID:     guest.ID,
			GuestName:  guest.RealName,
			GuestPhone: guest.Phone,
			Status:     model.OrderPaid,
			CheckInAt:  today.AddDate(0, 0, 7).Add(14 * time.Hour),
			CheckOutAt: today.AddDate(0, 0, 9).Add(12 * time.Hour),
			PaidAt:     formatDateTime(today.Add(-2 * time.Hour)),
		})
		usedRooms[roomID] = true
	}
	if roomID := firstVacantRoomID(s.Rooms(), usedRooms); roomID != "" {
		guest := nextGuest()
		s.seedOrder(seedOrderInput{
			RoomID:     roomID,
			UserID:     guest.ID,
			GuestName:  guest.RealName,
			GuestPhone: guest.Phone,
			Status:     model.OrderRefunded,
			CheckInAt:  today.AddDate(0, 0, 10).Add(14 * time.Hour),
			CheckOutAt: today.AddDate(0, 0, 12).Add(12 * time.Hour),
		})
	}

	// 6. 评价
	var firstCompleted model.Order
	for _, order := range s.Orders() {
		if order.Status == model.OrderCompleted {
			firstCompleted = order
			break
		}
	}
	s.reviews = []model.Review{
		{
			ID:        "RV1001",
			OrderID:   reviewedOrder.ID,
			OrderNo:   reviewedOrder.OrderNo,
			RoomID:    "R409",
			RoomNo:    "409",
			UserID:    demoUser.ID,
			UserName:  demoUser.RealName,
			Rating:    5,
			Content:   "一键睡眠场景非常丝滑，窗帘和灯光联动很舒服，会再来。",
			CreatedAt: formatDateTime(today.AddDate(0, 0, -5).Add(10 * time.Hour)),
		},
		{
			ID:        "RV1002",
			OrderID:   firstCompleted.ID,
			OrderNo:   firstCompleted.OrderNo,
			RoomID:    "R401",
			RoomNo:    "401",
			UserID:    "U2011",
			UserName:  "吴强",
			Rating:    4,
			Content:   "设备响应很快，就是空调面板的字体可以再大一点。",
			CreatedAt: formatDateTime(today.AddDate(0, 0, -3).Add(16 * time.Hour)),
		},
	}

	// 7. 设备：每间房 4 路（灯光 / 空调 / 窗帘 / 电视），已入住房间设备处于开启状态
	deviceDefinitions := []struct {
		deviceType string
		suffix     string
		name       string
		properties map[string]any
	}{
		{deviceType: model.DeviceLight, suffix: "LIGHT", name: "智能灯光", properties: map[string]any{"power": false, "brightness": 60, "color_temp": 4000}},
		{deviceType: model.DeviceAirConditioner, suffix: "AC", name: "智能空调", properties: map[string]any{"power": false, "mode": "cool", "temperature": 26, "fan_speed": "auto"}},
		{deviceType: model.DeviceCurtain, suffix: "CURTAIN", name: "电动窗帘", properties: map[string]any{"open_percent": 0}},
		{deviceType: model.DeviceTV, suffix: "TV", name: "智能电视", properties: map[string]any{"power": false, "volume": 30, "channel": 1}},
	}
	s.devices = make([]model.Device, 0, 200)
	for _, room := range s.Rooms() {
		occupied := room.Status == model.RoomOccupied
		for index, definition := range deviceDefinitions {
			properties := cloneProperties(definition.properties)
			if occupied {
				switch definition.deviceType {
				case model.DeviceLight:
					properties["power"] = true
					properties["brightness"] = 80
				case model.DeviceAirConditioner:
					properties["power"] = true
					properties["temperature"] = 24
				case model.DeviceCurtain:
					properties["open_percent"] = 100
				}
			}
			s.devices = append(s.devices, model.Device{
				ID:            "DEV-" + room.RoomNo + "-" + definition.suffix,
				RoomID:        room.ID,
				RoomNo:        room.RoomNo,
				SN:            "SN-" + room.RoomNo + "-" + pad2(index+1),
				Type:          definition.deviceType,
				Name:          definition.name,
				OnlineStatus:  model.DeviceOnline,
				Properties:    properties,
				Firmware:      "1.4.2",
				LastHeartbeat: formatDateTime(time.Now().Add(-time.Duration(rng.randomInt(1, 30)) * time.Minute)),
			})
		}
	}
	// 制造 1 台离线设备（DEV-310-LIGHT），供告警中心演示
	for index := range s.devices {
		if s.devices[index].ID == "DEV-310-LIGHT" {
			s.devices[index].OnlineStatus = model.DeviceOffline
			s.devices[index].Properties["power"] = false
		}
	}

	// 8. 场景（入住 / 睡眠 / 观影 / 离店），actions 为 {device_type, property, value}
	s.scenes = []model.Scene{
		{
			ID: "SCENE_WELCOME", Code: model.SceneWelcome, Name: "入住模式", Icon: "🏠",
			Description: "拉开窗帘、点亮暖光、空调 24℃",
			Actions: []model.SceneAction{
				{DeviceType: model.DeviceLight, Property: "power", Value: true},
				{DeviceType: model.DeviceLight, Property: "brightness", Value: 80},
				{DeviceType: model.DeviceLight, Property: "color_temp", Value: 3500},
				{DeviceType: model.DeviceAirConditioner, Property: "power", Value: true},
				{DeviceType: model.DeviceAirConditioner, Property: "temperature", Value: 24},
				{DeviceType: model.DeviceCurtain, Property: "open_percent", Value: 100},
				{DeviceType: model.DeviceTV, Property: "power", Value: false},
			},
		},
		{
			ID: "SCENE_SLEEP", Code: model.SceneSleep, Name: "睡眠模式", Icon: "🌙",
			Description: "全屋熄灯、闭合窗帘、空调 26℃ 静音",
			Actions: []model.SceneAction{
				{DeviceType: model.DeviceLight, Property: "power", Value: false},
				{DeviceType: model.DeviceAirConditioner, Property: "power", Value: true},
				{DeviceType: model.DeviceAirConditioner, Property: "temperature", Value: 26},
				{DeviceType: model.DeviceAirConditioner, Property: "fan_speed", Value: "low"},
				{DeviceType: model.DeviceCurtain, Property: "open_percent", Value: 0},
				{DeviceType: model.DeviceTV, Property: "power", Value: false},
			},
		},
		{
			ID: "SCENE_MOVIE", Code: model.SceneMovie, Name: "观影模式", Icon: "🎬",
			Description: "昏暗氛围光、闭合窗帘、电视开启",
			Actions: []model.SceneAction{
				{DeviceType: model.DeviceLight, Property: "power", Value: true},
				{DeviceType: model.DeviceLight, Property: "brightness", Value: 15},
				{DeviceType: model.DeviceLight, Property: "color_temp", Value: 3000},
				{DeviceType: model.DeviceCurtain, Property: "open_percent", Value: 0},
				{DeviceType: model.DeviceTV, Property: "power", Value: true},
				{DeviceType: model.DeviceTV, Property: "volume", Value: 35},
				{DeviceType: model.DeviceAirConditioner, Property: "temperature", Value: 24},
			},
		},
		{
			ID: "SCENE_LEAVE", Code: model.SceneLeave, Name: "离店模式", Icon: "🧳",
			Description: "关闭全部设备电源，节能省电",
			Actions: []model.SceneAction{
				{DeviceType: model.DeviceLight, Property: "power", Value: false},
				{DeviceType: model.DeviceAirConditioner, Property: "power", Value: false},
				{DeviceType: model.DeviceCurtain, Property: "open_percent", Value: 0},
				{DeviceType: model.DeviceTV, Property: "power", Value: false},
			},
		},
	}

	// 9. 告警（设备离线 / SOS / 设备故障，均为待处理）
	s.alarms = []model.Alarm{
		{
			ID: "AL1001", Type: "offline", TypeLabel: model.AlarmTypeLabel("offline"), Level: model.AlarmHigh,
			DeviceID: "DEV-310-LIGHT", DeviceName: "310 房智能灯光", RoomID: "R310", RoomNo: "310",
			Status: model.AlarmPending, CreatedAt: formatDateTime(time.Now().Add(-26 * time.Minute)),
			Content: "设备心跳超时 30 分钟，请检查网络或网关。",
		},
		{
			ID: "AL1002", Type: "sos", TypeLabel: model.AlarmTypeLabel("sos"), Level: model.AlarmHigh,
			DeviceID: "DEV-508-TV", DeviceName: "508 房 SOS 呼叫面板", RoomID: "R508", RoomNo: "508",
			Status: model.AlarmPending, CreatedAt: formatDateTime(time.Now().Add(-3 * time.Hour)),
			Content: "住客触发紧急呼叫，请前台立即响应。",
		},
		{
			ID: "AL1003", Type: "fault", TypeLabel: model.AlarmTypeLabel("fault"), Level: model.AlarmMedium,
			DeviceID: "DEV-407-AC", DeviceName: "407 房智能空调", RoomID: "R407", RoomNo: "407",
			Status: model.AlarmPending, CreatedAt: formatDateTime(time.Now().Add(-8 * time.Hour)),
			Content: "空调回风温度传感器异常，建议工程上门检修。",
		},
	}

	// 10. 能耗（近 30 天，确定性序列）
	energySeries := make([]model.EnergyPoint, 0, 30)
	for index := 29; index >= 0; index-- {
		timestamp := today.AddDate(0, 0, -index)
		electricity := rng.randomInt(720, 1180)
		water := rng.randomInt(38, 76)
		energySeries = append(energySeries, model.EnergyPoint{
			Date:           formatDate(timestamp),
			WeekDay:        dayNames[int(timestamp.Weekday())],
			ElectricityKWh: float64(electricity),
			WaterM3:        float64(water),
			Cost:           roundTo(float64(electricity)*0.82+float64(water)*3.6, 2),
		})
	}
	energyTotals := model.EnergyTotals{}
	for _, point := range energySeries {
		energyTotals.ElectricityKWh += point.ElectricityKWh
		energyTotals.WaterM3 += point.WaterM3
		energyTotals.Cost += point.Cost
	}
	energyTotals.WaterM3 = roundTo(energyTotals.WaterM3, 1)
	energyTotals.Cost = roundTo(energyTotals.Cost, 2)
	s.energy = model.EnergySummary{Days: 30, Series: energySeries, Totals: energyTotals}

	// 11. 经营看板趋势（近 30 天，静态序列保证图表视觉稳定）
	s.dashboardSeries = make([]model.DashboardTrendPoint, 0, 30)
	for index := 29; index >= 0; index-- {
		timestamp := today.AddDate(0, 0, -index)
		weekDay := int(timestamp.Weekday())
		isWeekend := weekDay == 0 || weekDay == 6
		occupancy := roundTo(0.52+rng.random()*0.2, 4)
		if isWeekend {
			occupancy = roundTo(0.78+rng.random()*0.16, 4)
		}
		revenue := math.Round(occupancy * 50 * float64(390+rng.randomInt(0, 260)))
		s.dashboardSeries = append(s.dashboardSeries, model.DashboardTrendPoint{
			Date:          formatDate(timestamp),
			WeekDay:       dayNames[weekDay],
			Revenue:       revenue,
			OccupancyRate: occupancy,
			ADR:           math.Round(390 + rng.random()*220),
		})
	}

	// 12. 升级方案物料库（范围 / 档次 / 清单规则）
	s.planCatalog = model.PlanCatalog{
		Scopes: []model.PlanScopeOption{
			{Value: model.PlanScopeRoom, Label: "单间客房", RoomCount: 1},
			{Value: model.PlanScopeFloor, Label: "整层楼", RoomCount: 10},
			{Value: model.PlanScopeStore, Label: "整店", RoomCount: 50},
		},
		Tiers: []model.PlanTierOption{
			{Value: model.PlanTierBasic, Label: "基础焕新", Description: "灯光 + 窗帘电动化，低成本快速见效"},
			{Value: model.PlanTierComfort, Label: "舒适进阶", Description: "灯光 + 窗帘 + 空调智控，覆盖高频体验场景"},
			{Value: model.PlanTierPremium, Label: "旗舰尊享", Description: "全屋智能联动，含影音与语音中控，打造样板房"},
		},
		Items: map[string][]model.PlanCatalogItem{
			model.PlanTierBasic: {
				{DeviceType: model.DeviceLight, Name: "智能灯光套装（2 路）", UnitPrice: 800, QtyPerRoom: 1},
				{DeviceType: model.DeviceCurtain, Name: "电动窗帘电机", UnitPrice: 600, QtyPerRoom: 1},
				{DeviceType: "panel", Name: "智能场景面板", UnitPrice: 300, QtyPerRoom: 1},
			},
			model.PlanTierComfort: {
				{DeviceType: model.DeviceLight, Name: "智能灯光套装（4 路）", UnitPrice: 1500, QtyPerRoom: 1},
				{DeviceType: model.DeviceCurtain, Name: "静音电动窗帘电机", UnitPrice: 900, QtyPerRoom: 1},
				{DeviceType: model.DeviceAirConditioner, Name: "中央空调智控模块", UnitPrice: 1200, QtyPerRoom: 1},
				{DeviceType: "panel", Name: "智能场景面板", UnitPrice: 500, QtyPerRoom: 1},
			},
			model.PlanTierPremium: {
				{DeviceType: model.DeviceLight, Name: "全屋智能灯光系统", UnitPrice: 2600, QtyPerRoom: 1},
				{DeviceType: model.DeviceCurtain, Name: "静音电动窗帘电机", UnitPrice: 900, QtyPerRoom: 1},
				{DeviceType: model.DeviceAirConditioner, Name: "中央空调智控模块", UnitPrice: 1200, QtyPerRoom: 1},
				{DeviceType: model.DeviceTV, Name: "电视语音控制器", UnitPrice: 800, QtyPerRoom: 1},
				{DeviceType: "gateway", Name: "全屋智能网关", UnitPrice: 1500, QtyPerRoom: 1},
				{DeviceType: "sensor", Name: "人体感应与SOS套装", UnitPrice: 700, QtyPerRoom: 1},
			},
		},
	}

	// 13. 升级方案：待审批 / 已通过 / 已驳回各 1 个
	pendingPlan := s.BuildPlanDraft(model.PlanScopeFloor, model.PlanTierComfort)
	pendingPlan.ID = "PLAN_1001"
	pendingPlan.Status = model.PlanPendingApproval
	pendingPlan.Name = "舒适进阶 · 整层楼（5F）"
	pendingPlan.CreatedAt = formatDateTime(today.AddDate(0, 0, -2).Add(10 * time.Hour))
	pendingPlan.Comment = "优先改造 5F 亲子房楼层，配合暑期活动。"

	approvedPlan := s.BuildPlanDraft(model.PlanScopeRoom, model.PlanTierPremium)
	approvedPlan.ID = "PLAN_1002"
	approvedPlan.Status = model.PlanApproved
	approvedPlan.Name = "旗舰尊享 · 样板房"
	approvedPlan.CreatedAt = formatDateTime(today.AddDate(0, 0, -6).Add(15 * time.Hour))
	approvedPlan.Approver = "王经理"
	approvedPlan.Comment = "已按样板房标准落地，可作为对外展示间。"

	rejectedPlan := s.BuildPlanDraft(model.PlanScopeStore, model.PlanTierBasic)
	rejectedPlan.ID = "PLAN_1003"
	rejectedPlan.Status = model.PlanRejected
	rejectedPlan.Name = "基础焕新 · 整店"
	rejectedPlan.CreatedAt = formatDateTime(today.AddDate(0, 0, -12).Add(11 * time.Hour))
	rejectedPlan.Approver = "王经理"
	rejectedPlan.Comment = "整店改造预算超限，建议先按楼层推进。"

	s.plans = []model.Plan{pendingPlan, approvedPlan, rejectedPlan}

	// 14. 发票：取前 6 个已完成 / 已评价订单（前 3 张已开，后 3 张待开）
	completedOrders := make([]model.Order, 0, 6)
	for _, order := range s.Orders() {
		if order.Status == model.OrderCompleted || order.Status == model.OrderReviewed {
			completedOrders = append(completedOrders, order)
		}
	}
	for index := 0; index < len(completedOrders) && index < 6; index++ {
		order := completedOrders[index]
		invoice := model.Invoice{
			ID:        fmt.Sprintf("INV%d", 1001+index),
			OrderID:   order.ID,
			OrderNo:   order.OrderNo,
			RoomNo:    order.RoomNo,
			GuestName: order.GuestName,
			Amount:    order.Amount,
			Title:     "个人",
			Status:    model.InvoicePending,
			CreatedAt: order.CreatedAt,
		}
		if index%2 == 1 {
			invoice.Title = "企业"
			invoice.TaxNo = "91330100MA2" + strconv.Itoa(rng.randomInt(100000, 999999))
		}
		if index < 3 {
			invoice.Status = model.InvoiceIssued
			invoice.IssuedAt = formatDateTime(today.AddDate(0, 0, -index).Add(9 * time.Hour))
		}
		s.invoices = append(s.invoices, invoice)
	}
}

// seedOrder 创建一条种子订单，并按订单状态同步房态 / 房间住客信息（房态机 3.2）。
// 同步逻辑在最终状态覆盖之前按初始状态执行，与前端 Mock db.js 行为保持一致。
func (s *Store) seedOrder(input seedOrderInput) model.Order {
	room, roomFound := s.RoomByID(input.RoomID)
	if !roomFound {
		// 种子数据保证房间存在；此处仅做防御，避免 panic。
		return model.Order{}
	}
	user, _ := s.UserByID(input.UserID)

	nights := int(math.Round(input.CheckOutAt.Sub(input.CheckInAt).Hours() / 24))
	if nights < 1 {
		nights = 1
	}
	guestName := input.GuestName
	if guestName == "" {
		guestName = user.RealName
	}
	if guestName == "" {
		guestName = "散客"
	}
	guestPhone := input.GuestPhone
	if guestPhone == "" {
		guestPhone = user.Phone
	}
	createdAt := input.CheckInAt.AddDate(0, 0, -3)

	order := model.Order{
		ID:           s.nextInternalID("ORD"),
		OrderNo:      s.NextOrderNo(createdAt),
		UserID:       input.UserID,
		RoomID:       room.ID,
		RoomTypeID:   room.RoomTypeID,
		RoomNo:       room.RoomNo,
		TypeName:     room.TypeName,
		Price:        room.Price,
		Nights:       nights,
		Amount:       room.Price * float64(nights),
		Status:       input.Status,
		CheckInTime:  formatDateTime(input.CheckInAt),
		CheckOutTime: formatDateTime(input.CheckOutAt),
		GuestName:    guestName,
		GuestPhone:   guestPhone,
		CreatedAt:    formatDateTime(createdAt),
		PaidAt:       input.PaidAt,
		CheckedOutAt: input.CheckedOutAt,
		CancelledAt:  input.CancelledAt,
		RefundReason: input.RefundReason,
		Source:       "c_app",
	}
	if order.Status == model.OrderCheckedIn {
		order.CheckedInAt = order.CheckInTime
	}

	switch input.Status {
	case model.OrderPaid, model.OrderConfirmed, model.OrderAwaitingCheckin:
		room.Status = model.RoomReserved
		room.GuestName = order.GuestName
		room.GuestPhone = order.GuestPhone
		room.CheckInTime = order.CheckInTime
		room.CheckOutTime = order.CheckOutTime
		room.CurrentOrderID = order.ID
		s.SaveRoom(room)
	case model.OrderCheckedIn:
		room.Status = model.RoomOccupied
		room.GuestName = order.GuestName
		room.GuestPhone = order.GuestPhone
		room.CheckInTime = order.CheckInTime
		room.CheckOutTime = order.CheckOutTime
		room.CurrentOrderID = order.ID
		s.SaveRoom(room)
	case model.OrderCompleted, model.OrderReviewed:
		room.Status = model.RoomDirty
		room.CurrentOrderID = ""
		s.SaveRoom(room)
	}

	if input.FinalStatus != "" {
		order.Status = input.FinalStatus
	}
	s.AddOrder(order)
	return order
}

// ---------------------------------------------------------------------------
// 种子数据辅助函数
// ---------------------------------------------------------------------------

var dayNames = []string{"周日", "周一", "周二", "周三", "周四", "周五", "周六"}

// startOfToday 返回今天 00:00（本地时区）。
func startOfToday() time.Time {
	now := time.Now()
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
}

// formatDateTime 格式化为契约时间格式 YYYY-MM-DD HH:mm。
func formatDateTime(value time.Time) string {
	return value.Format("2006-01-02 15:04")
}

// formatDate 格式化为契约日期格式 YYYY-MM-DD。
func formatDate(value time.Time) string {
	return value.Format("2006-01-02")
}

// pad2 两位数补零。
func pad2(value int) string {
	if value < 10 {
		return "0" + strconv.Itoa(value)
	}
	return strconv.Itoa(value)
}

// roundTo 四舍五入保留指定小数位。
func roundTo(value float64, digits int) float64 {
	factor := math.Pow(10, float64(digits))
	return math.Round(value*factor) / factor
}

// guestPhone 生成演示手机号（139 + 8 位）。
func guestPhone(index int) string {
	value := strconv.Itoa(10000000 + index*137)
	if len(value) > 8 {
		value = value[len(value)-8:]
	}
	return "139" + value
}

// cloneProperties 复制设备属性 map，避免多个设备共享同一份属性。
func cloneProperties(source map[string]any) map[string]any {
	result := make(map[string]any, len(source))
	for key, value := range source {
		result[key] = value
	}
	return result
}

// firstVacantRoomID 返回第一间可售且未被占用的房间 id（用于补充订单状态覆盖）。
func firstVacantRoomID(rooms []model.Room, used map[string]bool) string {
	for _, room := range rooms {
		if used[room.ID] {
			continue
		}
		if room.Status == model.RoomVacantReady && room.CurrentOrderID == "" {
			return room.ID
		}
	}
	return ""
}

// seedRNG 确定性伪随机数（线性同余，固定种子），保证每次启动种子数据一致。
type seedRNG struct {
	state uint32
}

func newSeedRNG(seed uint32) *seedRNG {
	return &seedRNG{state: seed}
}

// random 返回 [0,1) 之间的小数。
func (r *seedRNG) random() float64 {
	r.state = r.state*1664525 + 1013904223
	return float64(r.state) / 4294967296.0
}

// randomInt 返回 [min,max] 之间的整数。
func (r *seedRNG) randomInt(min, max int) int {
	if max <= min {
		return min
	}
	value := min + int(r.random()*float64(max-min+1))
	if value > max {
		value = max
	}
	return value
}
