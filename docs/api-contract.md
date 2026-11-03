# 智慧住家 · 前后端统一 API 契约

> C 端与 B 端**共用同一套接口定义**（需求文档 Prompt 指南）。
> 当前阶段由 `frontend/packages/shared-api/src/mock/` 提供 Mock 实现，路径、参数、返回结构与真实后端保持一致。
> 后端实现（`backend/`）必须按本契约提供同路径接口，前端只需关闭 Mock 开关即可切换。

---

## 1. 通用约定

### 1.1 基础信息

| 项 | 约定 |
| :--- | :--- |
| BaseURL | `/api`（Mock 阶段由前端拦截，不产生真实网络请求） |
| 请求头 | `Content-Type: application/json`；登录后携带 `Authorization: Bearer <token>` |
| 时间格式 | `YYYY-MM-DD HH:mm`；日期参数 `YYYY-MM-DD` |
| 金额单位 | 元（number，支持两位小数） |
| 分页参数 | `page`（从 1 开始）、`page_size` |
| Mock token | `mock-token-{userId}`，由登录接口返回 |

### 1.2 响应结构

```json
{ "code": 0, "message": "ok", "data": {} }
```

- `code === 0` 表示成功，`data` 为业务数据；
- `code !== 0` 表示业务失败，`message` 为可直接展示的提示文案，HTTP 状态仍为 200；
- 分页数据统一结构：`{ "list": [], "total": 100, "page": 1, "page_size": 10 }`。

### 1.3 错误码

| code | 含义 |
| :--- | :--- |
| 401 | 登录失效 |
| 403 / 4031 | 无权限 / 仅可控制当前入住房间设备 |
| 404 | 资源不存在（房间、订单、设备、方案等） |
| 1001~1007 | 登录与实名相关（手机号、验证码、员工账号、实名格式等） |
| 2001~2004 | 房态相关（未知房态、流转不合法、无需保洁等） |
| 4001~4007 | 订单相关（日期、房型可售、状态不允许等） |
| 5001~5005 | 设备相关（类型/属性不支持、离线、缺少属性等） |
| 6001 | 场景执行缺少 room_id |
| 7001 | 告警已处理 |
| 8001~8004 | 升级方案相关（范围、档次、状态不允许） |
| 9001 | 发票已开具 |

### 1.4 Mock 延迟（模拟真实网络体感）

| 接口 | 延迟 |
| :--- | :--- |
| 普通查询 | 160~380ms |
| 下单 / 退款 / 入住 / 退房 | 420~520ms |
| 支付回调 | 800ms |
| 场景执行 | 650ms |
| 实名认证 | 2000ms |

---

## 2. 认证 / 入驻（auth）

| 方法 | 路径 | 说明 | 请求 | 响应 data |
| :--- | :--- | :--- | :--- | :--- |
| POST | `/auth/login` | 顾客登录（手机号 + 验证码） | `{ phone, code }`，验证码固定 `1234` | `{ token, user }` |
| POST | `/auth/staff-login` | B 端员工登录 | `{ role }`（store_manager/frontdesk/finance/engineer） | `{ token, user }` |
| GET | `/auth/profile` | 当前用户 | — | `user` |
| POST | `/auth/real-name` | 实名认证（Mock 2 秒） | `{ real_name, id_card, image? }` | `user`（status 变 `normal`） |
| POST | `/auth/logout` | 退出登录 | — | `null` |
| GET | `/auth/demo-accounts` | 演示账号列表 | — | `{ customer, staff[] }` |
| GET | `/auth/me` | 当前用户或 null | — | `user \| null` |

## 3. 客房 / 房态（room）

| 方法 | 路径 | 说明 | 请求 | 响应 data |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/stores` | 门店列表 | — | `store[]` |
| GET | `/room-types` | 房型列表 | `store_id?` | `roomType[]` |
| GET | `/rooms/availability` | 按日期查可售房型 | `check_in_time?`, `check_out_time?` | `{ check_in_time, check_out_time, list }`（每项含 `available_count`、`available_rooms`） |
| GET | `/rooms` | 房态列表 | `store_id?`, `status?`, `floor?`, `room_type_id?`, `keyword?` | `{ list, total, status_legend }` |
| GET | `/rooms/:id` | 房间详情 | — | `room`（含 `devices[]`） |
| PATCH | `/rooms/:id/status` | 修改房态（前台） | `{ status }` | `room` |
| POST | `/rooms/:id/clean` | 保洁完成（脏房/维修 → 可售） | — | `room` |
| POST | `/rooms/:id/maintenance` | 标记维修 | — | `room` |
| GET | `/rooms/:id/devices` | 房间设备 | — | `device[]` |
| POST | `/devices/refresh` | 刷新全量设备心跳（演示） | — | `{ refreshed }` |

## 4. 订单（order）

| 方法 | 路径 | 说明 | 请求 | 响应 data |
| :--- | :--- | :--- | :--- | :--- |
| POST | `/orders` | 创建订单（→ 待支付，房间锁定为已预订） | `{ room_type_id, room_id?, check_in_time, check_out_time, guest_name?, guest_phone?, remark? }` | `order` |
| GET | `/orders` | 订单列表 | `self?=1`（仅自己）、`status?`、`keyword?`、`room_id?`、`page?`、`page_size?` | `{ list, total, page, page_size }` |
| GET | `/orders/:id` | 订单详情（支持 id 或订单号） | — | `order` |
| POST | `/orders/:id/pay` | 支付（待支付 → 已支付 → 已确认） | — | `order` |
| POST | `/orders/:id/cancel` | 取消（待支付 → 已取消） | — | `order` |
| POST | `/orders/:id/refund` | 申请退款（已支付/已确认/待入住 → 退款中） | `{ reason? }` | `order` |
| POST | `/orders/:id/refund/confirm` | 确认退款（退款中 → 已退款） | — | `order` |
| POST | `/orders/:id/check-in` | 办理入住（→ 已入住，激活设备控制权） | — | `order` |
| POST | `/orders/:id/check-out` | 办理退房（→ 已完成，房间转脏房） | — | `order` |
| POST | `/orders/:id/review` | 评价（已完成 → 已评价） | `{ rating: 1~5, content? }` | `order`（含 `review`） |
| GET | `/orders/:id/timeline` | 订单状态时间轴 | — | `step[]` |

> 状态流转合法性由 `shared-utils/status-machine.js` 的 `ORDER_TRANSITIONS` 校验；前端页面通过 `getOrderActions(status, audience)` 渲染操作按钮。

## 5. 设备（device）

| 方法 | 路径 | 说明 | 请求 | 响应 data |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/devices` | 查询：传 `room_id` 返回数组；否则返回分页对象 | `room_id?`, `type?`, `online_status?`, `keyword?`, `page?`, `page_size?` | `device[]` 或 `{ list, total, page, page_size }` |
| GET | `/devices/:id` | 设备详情 | — | `device` |
| PATCH | `/devices/:id/properties` | 下发属性（开关/亮度/温度/开合度…） | `{ [property]: value }` | `device` |
| POST | `/devices/:id/check` | 设备自检 | — | `{ ok, device, duration }` |
| POST | `/devices/:id/rebind` | 重新绑定（离线恢复上线） | — | `device` |

## 6. 场景（scene）

| 方法 | 路径 | 说明 | 请求 | 响应 data |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/scenes` | 预置场景（入住/睡眠/观影/离店） | — | `scene[]` |
| POST | `/scenes/:id/execute` | 一键执行（批量更新设备） | `{ room_id }` | `{ scene, room_id, devices, executed_at }` |

## 7. 经营看板 / 能耗（dashboard）

| 方法 | 路径 | 说明 | 请求 | 响应 data |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/dashboard/overview` | 核心指标 | — | 见下 |
| GET | `/dashboard/trend` | 营收/入住率/ADR 趋势 | `days?`（7~30，默认 30） | `{ days, list }` |
| GET | `/dashboard/room-status-distribution` | 房态分布（饼图） | — | `{ list, total }` |
| GET | `/energy/summary` | 能耗统计 | `days?` | `{ days, series, totals }` |

`overview` 字段：`date, room_total, room_occupied, room_reserved, room_vacant, room_dirty, room_maintenance, occupancy_rate, revenue_today, revenue_month, adr, guest_count, today_check_in, today_check_out, pending_alarms, pending_plans, avg_rating, total_orders`。

## 8. 告警（alarm）

| 方法 | 路径 | 说明 | 请求 | 响应 data |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/alarms` | 告警列表 | `status?`, `type?`, `level?` | `{ list, total, pending }` |
| POST | `/alarms/:id/handle` | 处理告警 | — | `alarm` |

## 9. 升级方案（plan）

| 方法 | 路径 | 说明 | 请求 | 响应 data |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/plans/catalog` | 物料库（范围/档次/清单规则） | — | `{ scopes, tiers, items }` |
| GET | `/plans` | 方案列表 | — | `{ list, total }` |
| POST | `/plans/generate` | 方案生成 | `{ scope: room/floor/store, tier: basic/comfort/premium }` | `plan` |
| GET | `/plans/:id` | 方案详情 | — | `plan` |
| POST | `/plans/:id/submit` | 提交审批（草稿 → 待审批） | — | `plan` |
| POST | `/plans/:id/approve` | 审批（待审批 → 已通过/已驳回） | `{ approved: true/false, comment? }` | `plan` |

## 10. 财务（finance）

| 方法 | 路径 | 说明 | 请求 | 响应 data |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/invoices` | 发票 / 对账列表 | `page?`, `page_size?`, `status?`, `keyword?` | `{ list, total, page, page_size }` |
| POST | `/invoices/:id/issue` | 开具发票 | — | `invoice` |

---

## 11. 关键流程示例

### 11.1 顾客完整链路

```text
1. POST /auth/login           { phone: "13800138000", code: "1234" } → token + user(已实名/已入住 305)
2. GET  /rooms/availability   ?check_in_time=2026-10-22&check_out_time=2026-10-24
3. POST /orders               { room_type_id: "RT01", check_in_time, check_out_time }
                              → order.status = pending_payment，房间变 reserved
4. POST /orders/:id/pay       → status = confirmed（Mock 支付回调）
5. POST /orders/:id/check-in  → status = checked_in，user.current_room_id = 房间
6. GET  /devices?room_id=...  → 4 路设备
7. PATCH /devices/:id/properties { power: true } → 设备状态更新（乐观更新 + 回写）
8. POST /scenes/SCENE_SLEEP/execute { room_id }  → 批量更新设备
9. POST /orders/:id/check-out → completed，房间 dirty，控制权回收
10. POST /orders/:id/review   { rating: 5, content: "..." } → reviewed
```

### 11.2 前台房态操作

```text
GET   /rooms?store_id=ST001                → 50 间房 + 图例
PATCH /rooms/:id/status { status: "dirty" } → 退房后转脏房（校验房态机）
POST  /rooms/:id/clean                     → 保洁完成转可售
```

### 11.3 方案审批

```text
GET  /plans/catalog
POST /plans/generate { scope: "floor", tier: "comfort" } → 设备清单 + 总预算
POST /plans/:id/submit
POST /plans/:id/approve { approved: true, comment: "同意" }
```

## 12. Mock 演示数据规模

| 数据 | 数量 | 说明 |
| :--- | :--- | :--- |
| 门店 | 1 | `ST001 智慧住家·未来城旗舰店` |
| 房型 | 5 | ¥399 ~ ¥999 |
| 客房 | 50 | 楼层 3~7，每层 10 间；5 种房态均覆盖 |
| 设备 | 200 | 每间房 4 路（灯光/空调/窗帘/电视），1 台离线用于告警演示 |
| 订单 | 30+ | 覆盖全部订单状态；演示顾客含待支付、已入住、已完成（可评价）、已评价、已取消 |
| 场景 | 4 | 入住 / 睡眠 / 观影 / 离店 |
| 告警 | 3 | 设备离线、SOS、设备故障 |
| 升级方案 | 3 | 待审批 / 已通过 / 已驳回 |
| 发票 | 6 | 已开 / 待开 |
| 能耗 & 看板 | 30 天 | 静态随机序列，图表视觉稳定 |
