# 智慧住家（Smart Home Hotel）· Go 后端骨架

> 模块名：`github.com/smart-home/hotel/backend`
> 语言 / 框架：Go 1.22 + Gin v1.10.0（纯标准库 + Gin，无 ORM、无 MQTT 依赖）
> 接口契约：与 [`docs/api-contract.md`](../docs/api-contract.md) 完全一致，接口前缀 `/api`
> 数据模型 / 状态机：与 [`docs/architecture.md`](../docs/architecture.md) 及前端 Mock 数据库同构

本目录是「智慧住家」项目的 Go(Gin) 后端骨架：用**内存仓库 + 程序化种子数据**实现了契约中的全部接口，
前端只需关闭 Mock 开关（`VITE_USE_MOCK=false` + 真实 `baseURL`）即可直接联调；后续把
`internal/store` 替换为 MySQL、`internal/iot` 接入 EMQX 即可平滑演进为真实后端。

---

## 1. 目录结构

```text
backend/
├─ go.mod / go.sum                 # Go 1.22 + gin v1.10.0（依赖哈希已锁定）
├─ README.md                       # 本文件
├─ .env.example                    # 环境变量模板（含 MySQL/Redis/EMQX 后期替换点）
├─ .gitignore
├─ api/
│  └─ openapi.yaml                 # 接口摘要（OpenAPI 3.0，联调/导入 Apifox 用）
├─ cmd/
│  └─ server/
│     └─ main.go                   # 进程入口：加载配置 -> 初始化内存库 -> 启动 Gin
└─ internal/
   ├─ config/config.go             # 配置加载（内置极简 .env 解析器，仅标准库）
   ├─ model/models.go              # 实体模型 + 接口视图 + 订单/房态状态机 + 枚举字典
   ├─ store/memory.go              # 内存仓库（sync.RWMutex）+ 全量确定性种子数据
   ├─ service/                     # 业务逻辑层（状态机、房态联动、设备属性、方案生成）
   │  ├─ service.go                # Service 聚合 + 通用工具（时间/分页/取整）
   │  ├─ auth.go room.go order.go device.go scene.go
   │  ├─ dashboard.go alarm.go plan.go finance.go
   ├─ handler/                     # HTTP 适配层（Gin）：参数绑定 + 错误码映射
   │  ├─ handler.go                # Handler 聚合 + JSON 绑定 + 统一错误处理
   │  ├─ auth.go room.go order.go device.go scene.go
   │  ├─ dashboard.go alarm.go plan.go finance.go health.go
   ├─ middleware/
   │  ├─ cors.go                   # CORS（允许全部来源，支持 OPTIONS 预检）
   │  ├─ logger.go                 # 请求日志（方法/路径/状态码/耗时/IP）
   │  ├─ auth.go                   # Bearer mock-token-<userId> 鉴权 + 可选鉴权
   │  └─ rbac.go                   # RBAC 权限矩阵（与前端 permission.js 同构）
   ├─ router/router.go             # 路由表（与契约一一对应）
   ├─ pkg/response/response.go     # {code,message,data} 统一响应 + 分页
   ├─ pkg/apperr/apperr.go         # 业务错误类型（契约错误码）
   └─ iot/mqtt.go                  # EMQX 接入扩展点（仅接口 + 注释，无 MQTT 依赖）
```

---

## 2. 分层架构与依赖方向

```text
cmd/server
   ↓
internal/router  ──注册路由/中间件──┐
   ↓                               │
internal/handler（HTTP 适配）     internal/middleware（CORS/日志/鉴权/RBAC）
   ↓                               │
internal/service（业务用例）       │
   ↓                               │
internal/store（内存仓库） ←────────┘（鉴权中间件按 token 查用户）
   ↓
internal/model（领域模型 / 状态机 / 枚举）
```

- **handler**：只做参数绑定、调用 service、把 `*apperr.Error` 映射为 `{code,message,data}`；不写业务规则。
- **service**：订单状态机、房态机、设备属性校验、场景批量下发、方案生成、看板统计等业务规则唯一入口。
- **store**：内存数据库，全部读写方法用 `sync.RWMutex` 保护；读操作返回实体副本，写操作按主键覆盖。
- **model**：数据结构 + 状态流转表 + 枚举中文名，禁止依赖上层；后续可 1:1 映射 MySQL 表。
- **middleware**：CORS、请求日志、`Authorization: Bearer mock-token-<userId>` 鉴权、RBAC。
- **iot**：只定义 `Client` / `Publisher` 接口与 topic 约定，当前占位实现只打日志。

> 依赖方向严格单向：`handler -> service -> store -> model`，`middleware -> store -> model`，
> `router -> handler + middleware`。没有循环依赖。

---

## 3. 快速开始

### 3.1 前置条件

- Go **1.22+**（`go version` 可验证）
- 无需 MySQL / Redis / EMQX：当前使用内存仓库，重启进程即恢复初始演示数据

### 3.2 启动

```bash
cd "Smart Home Hotel/backend"

# 1) 安装依赖（go.sum 已提交；首次拉取依赖时执行）
go mod tidy

# 2) 复制环境变量（Windows PowerShell: Copy-Item .env.example .env）
cp .env.example .env

# 3) 启动（默认监听 :8080；完整路径为 :<HTTP_PORT>）
go run ./cmd/server
```

启动成功后可访问：

- 健康检查：<http://127.0.0.1:8080/health> 或 <http://127.0.0.1:8080/api/health>
- 接口示例：<http://127.0.0.1:8080/api/stores>

### 3.3 编译 / 检查（可选）

```bash
go build ./...        # 编译全部包
go vet ./...          # 静态检查
gofmt -l .            # 格式检查（输出为空即通过）
```

### 3.4 前端切换真实接口

1. 后端启动后，把 `frontend` 各应用 `.env` 中 `VITE_USE_MOCK` 改为 `false`；
2. 配置 `VITE_API_BASE_URL=http://127.0.0.1:8080/api`；
3. 页面 / Pinia / 组件代码无需改动（接口路径、参数、返回结构与本仓库完全一致）。

### 3.5 curl 示例

```bash
# 顾客登录（任意 11 位手机号 + 验证码 1234）
curl -X POST http://127.0.0.1:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138000","code":"1234"}'

# 员工登录（store_manager / frontdesk / finance / engineer）
curl -X POST http://127.0.0.1:8080/api/auth/staff-login \
  -H "Content-Type: application/json" \
  -d '{"role":"store_manager"}'

# 携带 Mock token 访问受保护接口
curl http://127.0.0.1:8080/api/dashboard/overview \
  -H "Authorization: Bearer mock-token-ST1001"
```

---

## 4. 环境变量（`.env.example`）

| 变量 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `APP_ENV` | `development` | 运行环境标识（仅日志） |
| `HTTP_PORT` | `8080` | 监听端口（完整地址 `:<HTTP_PORT>`） |
| `GIN_MODE` | `debug` | Gin 模式：debug / release / test |
| `CORS_ALLOW_ORIGINS` | `*` | 允许来源（逗号分隔，`*` 为全部） |
| `MYSQL_DSN` | 空 | 后期替换内存仓库（当前仅打印日志） |
| `REDIS_ADDR` / `REDIS_PASSWORD` / `REDIS_DB` | 空 / 空 / `0` | 后期缓存登录态、设备属性 |
| `MQTT_BROKER` / `MQTT_USERNAME` / `MQTT_PASSWORD` | 空 | 后期接入 EMQX |
| `MQTT_TOPIC_TEMPLATE` | `hotel/{store_id}/room/{room_id}/device/{device_id}/command` | 设备指令 topic 模板 |

> 配置优先级：**进程环境变量 > `.env` 文件 > 代码默认值**；`.env` 由 `internal/config/config.go`
> 内置的极简解析器读取（仅标准库），生产环境建议用容器/K8s 注入环境变量。

---

## 5. 接口清单（与 `docs/api-contract.md` 对照）

> 统一响应：`{ "code": 0, "message": "ok", "data": ... }`；业务失败 `code != 0` 时 **HTTP 状态仍为 200**；
> 仅请求体 JSON 解析失败返回 HTTP 400。分页结构：`{ list, total, page, page_size }`。

### 5.1 认证 / 入驻（auth）

| 方法 | 路径 | 响应 data | 鉴权 |
| :--- | :--- | :--- | :--- |
| POST | `/api/auth/login` | `{ token, user }` | 公开 |
| POST | `/api/auth/staff-login` | `{ token, user }` | 公开 |
| GET | `/api/auth/profile` | `user` | Bearer |
| POST | `/api/auth/real-name` | `user`（status → normal） | Bearer |
| POST | `/api/auth/logout` | `null` | 公开 |
| GET | `/api/auth/demo-accounts` | `{ customer, staff[] }` | 公开 |
| GET | `/api/auth/me` | `user \| null` | 可选 Bearer |

### 5.2 客房 / 房态（room）

| 方法 | 路径 | 响应 data | 鉴权 / RBAC |
| :--- | :--- | :--- | :--- |
| GET | `/api/stores` | `store[]` | 公开 |
| GET | `/api/room-types` | `roomType[]`（`store_id?`） | 公开 |
| GET | `/api/rooms/availability` | `{ check_in_time, check_out_time, list }` | 公开 |
| GET | `/api/rooms` | `{ list, total, status_legend }` | 公开 |
| GET | `/api/rooms/:id` | `room`（含 `devices[]`） | 公开 |
| PATCH | `/api/rooms/:id/status` | `room` | Bearer + `b:room:operate` |
| POST | `/api/rooms/:id/clean` | `room` | Bearer + `b:room:operate` |
| POST | `/api/rooms/:id/maintenance` | `room` | Bearer + `b:room:operate` |
| GET | `/api/rooms/:id/devices` | `device[]` | 公开 |
| POST | `/api/devices/refresh` | `{ refreshed }` | Bearer + `b:device:view` |

### 5.3 订单（order）

| 方法 | 路径 | 响应 data | 鉴权 / RBAC |
| :--- | :--- | :--- | :--- |
| POST | `/api/orders` | `order` | `c:order:own` / `b:order:operate` |
| GET | `/api/orders` | `{ list, total, page, page_size }` | `c:order:own` / `b:order:view` |
| GET | `/api/orders/:id` | `order`（支持 id 或订单号） | 同上 |
| POST | `/api/orders/:id/pay` | `order`（pending_payment → paid → confirmed） | `c:order:own` / `b:order:operate` |
| POST | `/api/orders/:id/cancel` | `order`（→ cancelled） | 同上 |
| POST | `/api/orders/:id/refund` | `order`（→ refunding） | 同上 |
| POST | `/api/orders/:id/refund/confirm` | `order`（→ refunded） | `b:order:operate` |
| POST | `/api/orders/:id/check-in` | `order`（→ checked_in，绑定 `current_room_id`） | `c:order:own` / `b:order:operate` |
| POST | `/api/orders/:id/check-out` | `order`（→ completed，房间转 dirty） | 同上 |
| POST | `/api/orders/:id/review` | `order`（含 `review`，→ reviewed） | 同上 |
| GET | `/api/orders/:id/timeline` | `step[]`（5 个节点） | `c:order:own` / `b:order:view` |

### 5.4 设备（device）

| 方法 | 路径 | 响应 data | 鉴权 / RBAC |
| :--- | :--- | :--- | :--- |
| GET | `/api/devices` | 传 `room_id` → `device[]`；否则 → 分页对象 | `c:device:own_room` / `b:device:view` |
| GET | `/api/devices/:id` | `device` | 同上 |
| PATCH | `/api/devices/:id/properties` | `device`（属性合并 + 心跳更新） | `c:device:own_room` / `b:device:operate` |
| POST | `/api/devices/:id/check` | `{ ok, device, duration }` | `c:device:own_room` / `b:device:operate` |
| POST | `/api/devices/:id/rebind` | `device`（离线 → 在线） | `b:device:operate` |

### 5.5 场景（scene）

| 方法 | 路径 | 响应 data | 鉴权 / RBAC |
| :--- | :--- | :--- | :--- |
| GET | `/api/scenes` | `scene[]` | 公开 |
| POST | `/api/scenes/:id/execute` | `{ scene, room_id, devices, executed_at }` | `c:scene:own_room` / `b:device:operate` |

### 5.6 经营看板 / 能耗（dashboard）

| 方法 | 路径 | 响应 data | 鉴权 / RBAC |
| :--- | :--- | :--- | :--- |
| GET | `/api/dashboard/overview` | `overview`（见契约 §7 字段） | `b:dashboard:view` |
| GET | `/api/dashboard/trend?days=` | `{ days, list }`（7~30，默认 30） | `b:dashboard:view` |
| GET | `/api/dashboard/room-status-distribution` | `{ list, total }` | `b:dashboard:view` |
| GET | `/api/energy/summary?days=` | `{ days, series, totals }` | `b:energy:view` |

### 5.7 告警（alarm）

| 方法 | 路径 | 响应 data | 鉴权 / RBAC |
| :--- | :--- | :--- | :--- |
| GET | `/api/alarms` | `{ list, total, pending }` | `b:alarm:view` |
| POST | `/api/alarms/:id/handle` | `alarm` | `b:alarm:handle` |

### 5.8 升级方案（plan）

| 方法 | 路径 | 响应 data | 鉴权 / RBAC |
| :--- | :--- | :--- | :--- |
| GET | `/api/plans/catalog` | `{ scopes, tiers, items }` | 公开 |
| GET | `/api/plans` | `{ list, total }` | `b:plan:view` |
| POST | `/api/plans/generate` | `plan`（草稿） | `b:plan:create`（仅店长） |
| GET | `/api/plans/:id` | `plan` | 公开 |
| POST | `/api/plans/:id/submit` | `plan`（draft → pending_approval） | `b:plan:create`（仅店长） |
| POST | `/api/plans/:id/approve` | `plan`（approved / rejected） | `b:plan:approve`（**仅店长，其余角色 403**） |

### 5.9 财务（finance）

| 方法 | 路径 | 响应 data | 鉴权 / RBAC |
| :--- | :--- | :--- | :--- |
| GET | `/api/invoices` | `{ list, total, page, page_size }` | `b:finance:view` |
| POST | `/api/invoices/:id/issue` | `invoice` | `b:finance:operate` |

### 5.10 健康检查（骨架附加）

| 方法 | 路径 | 响应 data |
| :--- | :--- | :--- |
| GET | `/health`、`/api/health` | `{ status, service, version, time }` |

---

## 6. 统一错误码

| code | 含义 |
| :--- | :--- |
| 0 | 成功 |
| 401 | 登录失效（无 token / token 非法 / 用户不存在） |
| 403 | 无权限（RBAC 拦截） |
| 404 | 资源不存在（房间、订单、设备、场景、方案、告警、发票等） |
| 1001~1007 | 登录与实名（手机号、验证码、员工账号、实名格式） |
| 2001~2004 | 房态（未知房态、流转不合法、无需保洁、不能转维修） |
| 4001~4007 | 订单（日期格式、状态不允许、未实名入住、房间不可预订、房型无可售等） |
| 4031 | 顾客只能控制当前入住房间设备 |
| 5001~5005 | 设备（类型/属性不支持、离线、缺少属性、无响应） |
| 6001 | 场景执行缺少 `room_id` |
| 7001 | 告警已处理 |
| 8001~8004 | 升级方案（范围、档次、状态不允许） |
| 9001 | 发票已开具 |

> 业务错误 HTTP 状态一律 200（与前端 Mock 一致）；请求体 JSON 语法错误返回 HTTP 400 + `code:400`。

---

## 7. 演示账号

| 端 | 账号 | 凭据 | token |
| :--- | :--- | :--- | :--- |
| C 端顾客 | `13800138000`（或任意 11 位手机号） | 验证码 `1234` | `mock-token-U1000` |
| B 端店长 | 角色 `store_manager` | 免密 | `mock-token-ST1001` |
| B 端前台 | 角色 `frontdesk` | 免密 | `mock-token-ST1002` |
| B 端财务 | 角色 `finance` | 免密 | `mock-token-ST1003` |
| B 端运维 | 角色 `engineer` | 免密 | `mock-token-ST1004` |

> 演示顾客 `13800138000` 已实名且入住 `R305`，登录后可直接体验设备控制与场景切换。

---

## 8. 种子数据规模（程序化生成，确定性伪随机）

| 数据 | 规模 | 说明 |
| :--- | :--- | :--- |
| 门店 | 1 | `ST001 智慧住家·未来城旗舰店` |
| 房型 | 5 | RT01~RT05，¥399 ~ ¥999（每个房型都保证有可售房） |
| 客房 | 50 | 楼层 3~7，房号 301~710；5 种房态均覆盖（可售/已预订/已入住/脏房/维修中） |
| 用户 | 5 | 演示顾客 U1000（已实名、入住 R305）+ 员工 ST1001~ST1004 |
| 设备 | 200 | 每房 4 路（light / air_conditioner / curtain / tv）；`DEV-310-LIGHT` 离线用于告警演示 |
| 订单 | 36 | 覆盖全部 10 种订单状态；演示顾客含待支付/已入住/已评价/已取消 |
| 评价 | 2 | RV1001、RV1002 |
| 场景 | 4 | `SCENE_WELCOME` / `SCENE_SLEEP` / `SCENE_MOVIE` / `SCENE_LEAVE` |
| 告警 | 3 | 设备离线 / SOS / 设备故障（均待处理） |
| 升级方案 | 3 | 待审批（PLAN_1001）/ 已通过（PLAN_1002）/ 已驳回（PLAN_1003） |
| 发票 | 6 | 3 张已开、3 张待开 |
| 能耗 / 看板 | 30 天 | 确定性序列，图表视觉稳定（固定种子 LCG） |

> 内存态：进程重启后数据恢复初始状态（与前端 Mock 刷新页面重置的行为一致）。

---

## 9. 核心业务规则

### 9.1 订单状态机（服务端强校验）

```text
pending_payment ──支付──> paid ──自动确认──> confirmed
      │                                   │  ├──待入住──> awaiting_checkin
      └──取消──> cancelled                │  └──入住────────> checked_in
                                          │                        └──退房──> completed ──评价──> reviewed
paid / confirmed / awaiting_checkin ──申请退款──> refunding ──确认退款──> refunded
```

- 流转表位于 `internal/model/models.go`（`CanOrderTransition`），与前端 `status-machine.js` 一致；
- 非法流转返回 `4002`（房态非法返回 `2002`）；
- 支付接口模拟「待支付 → 已支付 → 已确认」连续流转并写入 `paid_at`；
- 入住时把 `users.current_room_id` 绑定为订单房间；退房时清空控制权并置房态为 `dirty`；
- 顾客只能操作自己的订单（否则 `403`），员工按 RBAC 放行。

### 9.2 客房房态机

```text
vacant_ready ──下单/标记维修──> reserved / maintenance
reserved ──入住/取消退款──> occupied / vacant_ready
occupied ──退房──> dirty ──保洁──> vacant_ready
maintenance ──保洁/维修完成──> vacant_ready
```

- 前端 `PATCH /rooms/:id/status` 与后端都走同一份 `ROOM_TRANSITIONS` 校验；
- 保洁接口只接受 `dirty` / `maintenance`（否则 `2003`）；
- 转可售 / 脏房时清空房间住客信息与关联订单号。

### 9.3 设备控制权与属性下发

- 顾客 JWT（Mock token）解析出的 `current_room_id` 必须与设备 `room_id` 一致，否则 `4031`；
- 属性下发校验顺序：设备存在（404）→ 控制权（4031）→ 在线（5003）→ 设备类型支持（5001）→
  属性 key 属于该类型（5002）→ 至少一个属性（5004）；
- 属性白名单与前端 `DEVICE_PROPERTY_SCHEMA` 一致：
  - `light`: `power` / `brightness` / `color_temp`
  - `air_conditioner`: `power` / `mode` / `temperature` / `fan_speed`
  - `curtain`: `open_percent`
  - `tv`: `power` / `volume` / `channel`
- 场景执行 = 按 `actions[{device_type,property,value}]` 批量合并房间内同类设备属性，并刷新心跳。

### 9.4 RBAC 权限矩阵（与前端 `permission.js` 同构）

| 角色 | 权限 |
| :--- | :--- |
| `store_manager` 店长 | `*`（全部权限，含方案审批） |
| `frontdesk` 前台 | 看板、房态查看/操作、订单查看/操作、设备查看、告警查看/处理 |
| `finance` 财务 | 看板、订单查看、财务查看/操作（发票） |
| `engineer` 运维 | 房态查看、全局设备查看/操作、告警查看/处理、能耗、方案查看 |
| `customer` 顾客 | 预订、自己的订单、当前入住房间设备/场景 |

- 未登录访问受保护接口 → `401`；无权限 → `403`（HTTP 状态仍为 200）；
- **方案审批** `POST /api/plans/:id/approve` 仅店长可调用，其他员工角色返回 `403`。

### 9.5 升级方案生成规则

按 `scope`（`room`=1 间 / `floor`=10 间 / `store`=50 间）× `tier` 物料库计算：

```text
qty = qty_per_room × room_count
amount = qty × unit_price
total_price = Σ amount
```

- `basic` 单间 ¥1,700；`comfort` 单间 ¥4,100；`premium` 单间 ¥7,700；
- 方案状态机：`draft` →（提交）`pending_approval` →（审批）`approved` / `rejected`；
- 非法范围 / 档次 / 状态分别返回 `8001` / `8002` / `8003` / `8004`。

---

## 10. 路由注册说明（Gin 静态段与通配符冲突）

Gin 底层路由树源自 httprouter，**不允许同一层同时存在静态段与通配符参数段**，
因此契约中的以下 4 个静态路径不能与同层 `:id` 路由共同注册，否则启动时会 panic。
本仓库通过「复用同层 `:id` 入口 + handler 内二次分发」保持**对外 URL 完全不变**：

| 对外路径 | 实际注册路由 | 分发逻辑 |
| :--- | :--- | :--- |
| `GET /api/rooms/availability` | `GET /api/rooms/:id` | `id == "availability"` → 可售房型 |
| `GET /api/plans/catalog` | `GET /api/plans/:id` | `id == "catalog"` → 物料库 |
| `POST /api/plans/generate` | `POST /api/plans/:id` | `id == "generate"` → 方案生成 |
| `POST /api/devices/refresh` | `POST /api/devices/:id` | `id == "refresh"` → 心跳刷新 |

> 其余接口均按契约原路径注册；详细实现见 `internal/router/router.go` 与对应 handler 的 `XxxOrXxx` 方法。
> 若后续 Gin 版本支持静态/通配符共存，可删除这 4 处分发逻辑，直接注册静态路径。

---

## 11. 后续替换点（MySQL / Redis / EMQX / JWT）

| 能力 | 当前实现 | 替换位置 / 步骤 |
| :--- | :--- | :--- |
| 持久化 | `internal/store/memory.go`（内存 + 种子数据） | 新增 `internal/store/mysql.go`，保持相同方法签名（`Rooms()/RoomByID()/SaveRoom()` …），按 `MYSQL_DSN` 初始化；种子数据改为 SQL 迁移脚本 |
| 登录态 / 缓存 | Mock token（`mock-token-<userId>`，无状态） | `internal/middleware/auth.go` 改为 JWT 签发/校验；Redis 存 token 黑名单与设备属性缓存（`REDIS_ADDR`） |
| IoT 指令下发 | `internal/iot/mqtt.go` 的 `Publisher` 占位（只打日志） | `go get github.com/eclipse/paho.mqtt.golang`，实现 `iot.Client`；在 `device.go` / `scene.go` 属性变更处调用 `Publisher.PublishCommand`；设备上报通过 `Subscribe` 回调写回 store |
| 人工网络延迟 | 无（真实 HTTP 天然延迟） | Mock 阶段 160~2000ms 延迟仅由前端 `mock/index.js` 模拟，后端不需要 |
| 权限 | RBAC 内存矩阵 | 可迁移到 Casbin / 数据库权限表，保持 `middleware.Require(...)` 调用点不变 |
| 日志 / 监控 | 标准库 `log` 打印方法/路径/耗时/状态 | 替换为 zap / logrus，或接入 OpenTelemetry |

> 所有「后期替换点」在代码中均有中文注释标注（搜索 `后期替换点` / `TODO`）。

---

## 12. 编译与联调验证记录

- **语法/格式**：`gofmt -l .` 无输出（全部文件已格式化，无语法错误）。
- **编译**：`go build ./...` 通过。
- **静态检查**：`go vet ./...` 通过。
- **接口冒烟测试**：启动真实进程后按契约逐项调用（公开接口、登录、RBAC、订单/房态状态机、
  设备属性、场景、看板、方案审批、告警、发票、异常错误码等），75 项核心断言全部通过。
- 冒烟测试覆盖的关键点：`GET /devices?room_id=` 返回数组 / 不传返回分页对象、
  方案审批非店长 403、非法订单/房态流转 2002/4002、离线设备 5003、顾客跨房间控制 4031、
  token 非法 401、业务错误 HTTP 200 等。

> 本机 `PATH` 中未安装 Go；交付时使用环境中已有的临时 Go 工具链完成上述 `gofmt` / `go build` /
> `go vet` / 冒烟验证（未向系统安装 Go）。如标准环境有 Go 1.22+，直接执行
> `go mod tidy && go build ./...` 即可复现。若 `go mod tidy` 因网络受限失败，可配置国内代理：
> `GOPROXY=https://goproxy.cn,direct`。

---

## 13. 已知限制 / TODO

1. **数据仅内存态**：重启进程恢复种子数据，不支持多实例共享（替换 MySQL 后解决）。
2. **Token 无过期/刷新**：Mock token 规则与前端一致，正式环境替换 JWT + 刷新令牌。
3. **设备属性只做 key 白名单校验**：未做取值范围/枚举值强校验（如 brightness 0~100），
   前端控件已限制范围；接入真实 IoT 时在 `UpdateDeviceProperties` 中补充。
4. **无真实 MQTT 通信**：`internal/iot/mqtt.go` 仅接口与占位实现。
5. **无单元测试**：本次以 `go vet` + 真实进程冒烟测试验证；建议后续为 service 层补表驱动测试。
6. **CORS 全部放开**：联调方便，生产环境需按 `CORS_ALLOW_ORIGINS` 收紧（配置项已预留）。
7. **Gin 静态/通配符路由限制**：见第 10 节的分发说明。
