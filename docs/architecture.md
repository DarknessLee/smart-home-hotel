# 智慧住家（Smart Home Hotel）· 架构与数据模型

> 版本：v0.1.0（MVP / Mock 阶段）
> 依据：《智慧住家-需求文档》全链路智能家居平台
> 技术约束：**纯 JavaScript（ES6+），不使用 TypeScript**；所有业务数据走 Mock；接口字段对齐真实业务标准。

---

## 1. 项目定位与 MVP 边界

| 维度 | MVP 阶段做法 |
| :--- | :--- |
| 产品形态 | B 端 + C 端双端同源，共用一套接口定义 |
| 数据 | 全部 Mock（`@smart-home/api` 内置），数据存于 Pinia，通过 Actions 修改 |
| 真实后端 | 后期对接 Go(Gin) / Java(Spring Boot)，`backend/` 已留分层骨架 |
| IoT | 后期接入 EMQX(MQTT)，Mock 阶段用属性 JSON 模拟设备状态 |
| 测试指标 | 「能用就行」：页面视觉、路由跳转、订单状态机、房态图、设备控制面板可交互 |

## 2. 目录结构

```text
Smart Home Hotel/
├─ README.md                          # 项目总说明 / 启动方式
├─ docs/
│  ├─ architecture.md                 # 本文件：架构、数据模型、状态机、权限
│  └─ api-contract.md                 # 前后端统一 API 契约（C/B 共用）
├─ frontend/                          # pnpm workspace 前端 Monorepo
│  ├─ package.json                    # workspace 根脚本
│  ├─ pnpm-workspace.yaml
│  ├─ packages/
│  │  ├─ shared-utils/                # 常量、状态机、权限、格式化、存储
│  │  ├─ shared-api/                  # axios 封装 + Mock 拦截 + 业务 API
│  │  │  └─ src/mock/                 # Mock 数据库与接口实现（后期可整体移除）
│  │  └─ shared-stores/               # Pinia 模块（Mock 阶段也走 Actions）
│  └─ apps/
│     ├─ customer/                    # C 端：uni-app（Vue3 + JS），H5/小程序/APP
│     └─ admin/                       # B 端：Vite + Vue3 + Element Plus + ECharts
└─ backend/                           # Go(Gin) 后端骨架（当前为占位/Mock 同构实现）
```

## 3. 核心数据模型（Mock 数据字典）

> 加粗字段为需求文档第 5 章明确要求，其余为 MVP 扩展字段（命名遵循后端既有规范，后期可直接落库）。

### 3.1 users（用户 / 员工）

| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| **id** | string | 主键，如 `U1000` |
| **phone** | string | 手机号（登录账号） |
| **real_name** | string | 实名姓名，未认证为空 |
| **id_card** | string | 身份证号，未认证为空（UI 展示需脱敏） |
| **status** | `normal` \| `unverified` \| `disabled` | 账号 / 实名状态 |
| role | `customer` \| `store_manager` \| `frontdesk` \| `finance` \| `engineer` | 扩展：RBAC 角色 |
| current_room_id | string | 扩展：当前入住房间（设备控制权依据） |
| created_at | string | 扩展：注册时间 |

### 3.2 rooms（客房）

| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| **id** | string | 主键，如 `R305` |
| **store_id** | string | 门店 id，如 `ST001` |
| **room_no** | string | 房号，如 `305`（楼层+序号，共 50 间） |
| **type_name** | string | 房型名称快照 |
| **status** | `vacant_ready` \| `reserved` \| `occupied` \| `dirty` \| `maintenance` | 房态机（见 4.2） |
| room_type_id | string | 扩展：房型 id |
| price | number | 扩展：当前房价（元/晚） |
| floor | number | 扩展：楼层（3~7） |
| guest_name / guest_phone | string | 扩展：在住 / 预订客人信息 |
| check_in_time / check_out_time | string | 扩展：住客时间 |
| current_order_id | string | 扩展：当前关联订单 |

API 返回时附加：`status_label`、`order_status`、`order_status_label`；详情接口 `GET /rooms/:id` 额外含 `devices`。

### 3.3 room_types（房型）

`{ id, store_id, name, price, area, bed_type, capacity, cover_color, tags[], description, available_count? }`

MVP 预置 5 种房型：轻享大床房 ¥399、悦享双床房 ¥459、亲子家庭房 ¥599、巨幕影音房 ¥699、行政套房 ¥999。

### 3.4 orders（订单）

| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| **id** | string | 主键，如 `ORD_...` |
| **user_id** | string | 下单用户 |
| **room_id** | string | 房间 id |
| **amount** | number | 订单金额（元） |
| **status** | 见 4.1 | 订单状态机 |
| **check_in_time** | string | 入住时间 `YYYY-MM-DD HH:mm` |
| **check_out_time** | string | 离店时间 `YYYY-MM-DD HH:mm` |
| order_no | string | 扩展：订单号，如 `ORD20261021001` |
| room_type_id / room_no / type_name / price | string/number | 扩展：下单房间快照 |
| nights | number | 扩展：间夜数 |
| guest_name / guest_phone | string | 扩展：入住人信息 |
| created_at / paid_at / checked_in_at / checked_out_at / cancelled_at | string | 扩展：状态时间戳 |
| refund_reason | string | 扩展：退款原因 |
| review_id | string | 扩展：评价 id |
| source | string | 扩展：`c_app` / `frontdesk` |
| remark | string | 扩展：备注 |

API 返回时附加：`status_label`、`can_control_devices`。

### 3.5 devices（设备）

| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| **id** | string | 主键，如 `DEV-305-LIGHT` |
| **room_id** | string | 所属房间 |
| **sn** | string | 设备序列号 |
| **type** | `light` \| `air_conditioner` \| `curtain` \| `tv` | 设备类型 |
| **online_status** | `online` \| `offline` | 在线状态 |
| **properties** | object | 属性集合（见下表） |
| room_no / name / firmware / last_heartbeat | string | 扩展：房号、名称、固件、心跳 |

设备属性（`DEVICE_PROPERTY_SCHEMA` 单一来源）：

| type | properties |
| :--- | :--- |
| light | `{ power: boolean, brightness: 0~100, color_temp: 3000~6500 }` |
| air_conditioner | `{ power: boolean, mode: 'cool'\|'heat'\|'auto'\|'dry'\|'fan', temperature: 16~30, fan_speed: 'auto'\|'low'\|'mid'\|'high' }` |
| curtain | `{ open_percent: 0~100 }` |
| tv | `{ power: boolean, volume: 0~100, channel: 1~20 }` |

### 3.6 scenes（场景）

| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| **id** | string | 主键，如 `SCENE_WELCOME` |
| **name** | string | 入住模式 / 睡眠模式 / 观影模式 / 离店模式 |
| **actions** | Array<{ device_type, property, value }> | 批量设备属性动作 |
| code / icon / description | string | 扩展：枚举、图标、描述 |

### 3.7 其他模型

- **alarms**：`{ id, type: offline|sos|fault, level: high|medium|low, device_id, device_name, room_id, room_no, status: pending|handled, created_at, handled_at, handler, content, type_label }`
- **reviews**：`{ id, order_id, order_no, room_id, room_no, user_id, user_name, rating:1~5, content, created_at }`
- **plans（升级方案）**：`{ id, name, scope: room|floor|store, scope_label, scope_value（房间数）, tier: basic|comfort|premium, tier_label, room_count, items:[{device_type,name,qty,unit_price,amount}], total_price, status: draft|pending_approval|approved|rejected, creator, approver, comment, created_at, approved_at }`
- **invoices**：`{ id, order_id, order_no, room_no, guest_name, amount, title: 个人|企业, tax_no, status: pending|issued, issued_at, created_at }`
- **energy**：`{ series:[{date,week_day,electricity_kwh,water_m3,cost}], totals:{electricity_kwh,water_m3,cost} }`
- **dashboard**：`overview`（营收/入住率/ADR/房态数量/待处理告警等）+ `trend:[{date,week_day,revenue,occupancy_rate,adr,occupancy_percent}]` + `distribution:[{status,label,color,count,percent}]`

## 4. 核心状态机

### 4.1 订单与入住状态机（需求文档 3.1）

```text
待支付 pending_payment
  ├─ 支付 → 已支付 paid → 已确认 confirmed
  │            ├─ 待入住 awaiting_checkin → 已入住 checked_in → 已完成 completed → 已评价 reviewed
  │            └─ 退款中 refunding → 已退款 refunded
  └─ 取消 → 已取消 cancelled

已确认 / 待入住 / 已支付 ──申请退款──> 退款中 refunding ──确认退款──> 已退款 refunded
```

流转表（`shared-utils/status-machine.js` 单点维护）：

| 当前状态 | 允许的下一状态 | 触发动作 / 接口 |
| :--- | :--- | :--- |
| pending_payment | paid, cancelled | `POST /orders/:id/pay`（Mock 支付回调连续进入 confirmed）、`/cancel` |
| paid | confirmed, refunding | 自动确认、`POST /orders/:id/refund` |
| confirmed | awaiting_checkin, checked_in, refunding | `POST /orders/:id/check-in`、`/refund` |
| awaiting_checkin | checked_in, refunding | `POST /orders/:id/check-in`、`/refund` |
| checked_in | completed | `POST /orders/:id/check-out` |
| completed | reviewed | `POST /orders/:id/review` |
| refunding | refunded | `POST /orders/:id/refund/confirm`（B 端） |

操作定义（`ORDER_ACTIONS`）同时决定按钮文案、可见角色端（customer/staff）与二次确认，页面禁止硬编码状态字符串。

### 4.2 客房房态机（需求文档 3.2）

```text
可售 vacant_ready → 已预订 reserved → 已入住 occupied → 脏房 dirty → 维修中 maintenance → 可售
```

| 当前房态 | 允许流转 | 触发 |
| :--- | :--- | :--- |
| vacant_ready | reserved, maintenance | 下单、标记维修 |
| reserved | occupied, vacant_ready | 入住、取消 / 退款完成 |
| occupied | dirty | 退房 |
| dirty | vacant_ready | 保洁完成 `POST /rooms/:id/clean` |
| maintenance | vacant_ready | 维修完成（保洁入口） |

配色：可售 `#52C41A`（绿）、已入住 `#F5222D`（红）、已预订 `#FAAD14`（黄）、脏房 `#8C8C8C`（灰）、维修中 `#2F54EB`（蓝）。

### 4.3 设备控制权规则

1. 订单进入 `checked_in` 且已完成实名认证后，`users.current_room_id` 绑定房间；
2. C 端设备面板只读取 `current_room_id` 对应房间的设备；
3. Mock 接口侧对顾客请求做兜底校验（非本房间设备返回 `4031`）；
4. 退房后 `current_room_id` 清空，设备控制权自动回收。

## 5. RBAC 角色权限

| 角色 | 端 | 核心权限 |
| :--- | :--- | :--- |
| 顾客 customer | C | 预订下单、查看自己订单、控制当前房间设备、执行场景、实名入住 |
| 店长 store_manager | B | 全部权限（含方案审批、人员管理） |
| 前台 frontdesk | B | 房态操作、订单接单 / 入住 / 退房、设备查看、告警处理 |
| 财务 finance | B | 看板、订单查看、财务对账与发票 |
| 工程运维 engineer | B | 全局设备控制（无视房间隔离）、告警处理、能耗查看 |

- 权限码：`c:*` / `b:*`（`shared-utils/permission.js` 的 `PERMISSION`）；
- B 端菜单：`ADMIN_MENUS`（key/title/path/icon/permission/group）+ `getMenuGroupsByRole(role)`；
- 路由守卫：`meta.permission` 不满足时跳转 403；
- Mock 阶段只在 UI 层控制（需求文档第 6 章），后端权限后续补。

## 6. 前端架构约定

### 6.1 请求链路（axios 封装 + Mock 开关）

```text
组件 → Pinia Action → @smart-home/api/xxxApi → request()
                                             ├─ mock: true  → mock/index.js 分发（内存数据库）
                                             └─ mock: false → axios（或 uni.request 适配器）→ 真实后端
```

- 响应统一 `{ code, message, data }`，`code === 0` 成功，否则 reject `Error{code,message}`；
- 请求头自动携带 `Authorization: Bearer <token>`；
- 运行时配置与 axios 实例挂载在 `globalThis` 上：uni-app 构建可能出现 shared-api 多副本，若只改局部变量会导致「登录走真实接口、其它请求仍走 Mock」，单例化后所有副本共享同一开关；
- Mock 延迟 160~900ms（登录 420ms、实名 2000ms、场景 650ms、支付 800ms），接近真实体感；
- C 端 `initHttp` 传入 `uniRequestAdapter`，B 端直接用 axios 默认传输；
- 关闭 Mock：`.env` 中 `VITE_USE_MOCK=false`，并在 `initHttp` 配置真实 `baseURL`，页面代码零改动。

### 6.2 Pinia 模块（`@smart-home/stores`）

| 模块 | 职责 | 关键 Actions |
| :--- | :--- | :--- |
| useAuthStore | 登录态、角色、实名 | `login` / `staffLogin` / `realNameVerify` / `logout` / `restore` |
| useAppStore | UI 状态、侧边栏 | `boot` / `toggleSidebar` |
| useRoomStore | 房态数据 | `fetchRooms` / `fetchRoom` / `changeStatus` / `cleanRoom` |
| useOrderStore | 订单状态机 | `fetchOrders` / `createOrder` / `pay` / `cancel` / `refund` / `checkIn` / `checkOut` / `review` |
| useDeviceStore | 设备控制（乐观更新） | `fetchDevices` / `updateProperty` / `applySceneDevices` |
| useSceneStore | 场景一键切换 | `fetchScenes` / `execute` |
| useDashboardStore | 经营看板 / 能耗 | `fetchOverview` / `fetchTrend` / `fetchDistribution` / `fetchEnergy` |
| useAlarmStore | 告警中心 | `fetchAlarms` / `handle` |
| usePlanStore | 升级方案 | `fetchCatalog` / `generate` / `submit` / `approve` |

### 6.3 C 端 uni-app 约定（`frontend/apps/customer`）

- 入口：`src/main.js`（`createSSRApp` + Pinia + `initHttp`），`src/pages.json` 配置路由与 tabBar；
- 页面：`src/pages/**`，统一使用 `<script setup>` + 纯 JS；
- 视觉：主色 `#1677FF`，圆角卡片，C 端移动优先（375px 设计宽度，rpx 单位）；
- tabBar：首页 / 客房 / 设备 / 我的；未入住时设备页展示「办理入住」引导；
- 场景 / 设备交互必须通过 Pinia actions，禁止页面内直接改 store state。

### 6.4 B 端 admin 约定（`frontend/apps/admin`）

- 技术：Vue3 + Vue Router + Pinia + Element Plus + ECharts 6；
- 布局：左侧菜单（`getMenuGroupsByRole` 动态渲染）+ 顶栏（门店、Mock 标识、角色切换）+ 内容区；
- 路由：`meta.permission` 做守卫；页面懒加载；
- 图表：ECharts 按需 `import * as echarts from 'echarts'`，容器需 `resize` 监听；
- 房态图：50 间房网格（按楼层分组），颜色取自 `ROOM_STATUS_COLOR`，点击弹出操作抽屉 / 弹窗。

## 7. Mock 数据与真实接口切换

1. Mock 数据全部集中在 `frontend/packages/shared-api/src/mock/`（`db.js` 造数 + `modules/*.js` 路由）；
2. Mock 是**内存态**：刷新页面回到初始演示数据（订单、房态、设备状态的修改会保留在当前 SPA 生命周期内）；
3. 切换真实接口步骤：
   1. 部署后端，实现 `docs/api-contract.md` 中同路径接口；
   2. 修改 `.env`：`VITE_USE_MOCK=false`、`VITE_API_BASE_URL=https://your-api`；
   3. 删除 `shared-api/src/mock/` 目录（或保留，接口层开关已隔离）；
   4. 页面 / Pinia / 组件代码无需改动。

## 8. 后端骨架（`backend/`）

- 语言：Go 1.22+，Web 框架 Gin；
- 分层：`cmd/server` → `internal/router` → `internal/handler` → `internal/service` → `internal/store`（内存版，后期换 MySQL/Redis）；
- 中间件：CORS、JWT 鉴权、RBAC、请求日志；
- 接口路径与 `docs/api-contract.md` 完全一致，与前端 Mock 同构；
- IoT 扩展点：`internal/iot/`（MQTT 客户端接入 EMQX）、设备属性下发服务；
- 当前 MVP 阶段前端不依赖后端，后端作为后期对接骨架。

## 9. 开发命令与演示账号

```bash
# 安装依赖（在 frontend 目录）
pnpm install

# C 端 H5（http://localhost:5173）
pnpm dev:customer
# B 端管理后台（http://localhost:5174）
pnpm dev:admin

# 生产构建
pnpm build:customer
pnpm build:admin
```

| 端 | 账号 | 密码 / 验证码 |
| :--- | :--- | :--- |
| C 端顾客 | 任意 11 位手机号（推荐 `13800138000`） | 验证码 `1234` |
| B 端店长 | 角色选择「店长」 | 免密（Mock） |
| B 端前台 / 财务 / 运维 | 角色选择对应角色 | 免密（Mock） |

> 演示顾客 `13800138000` 已完成实名且入住 `305` 房，登录后即可体验设备控制面板；
> 其名下还包含待支付、已完成（可评价）、已评价、已取消订单，可直接演示订单状态机各分支。

## 10. MVP 验收清单

- [x] C 端：登录 → 房型查询 → 下单 → 支付 → 实名 → 入住 → 设备控制 / 场景切换 → 退房 → 评价
- [x] B 端：经营看板（ECharts）、50 间房态图、订单流转、设备运维、告警处理、升级方案生成 / 审批、财务对账
- [x] 订单状态机与房态机全程可流转，非法流转被拦截
- [x] Mock 与真实接口一键切换，页面代码不改
- [x] 纯 JavaScript（无 `.ts` 文件）
