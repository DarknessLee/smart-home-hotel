/**
 * Mock / API 层冒烟测试（无需浏览器、无需 uni-app 运行时）。
 *
 * 覆盖：登录鉴权、房态查询、订单状态机全链路、设备控制与权限兜底、
 *       场景执行、看板数据、告警、升级方案、财务发票。
 *
 * 运行方式（在 frontend 目录）：
 *   pnpm --filter @smart-home/api test
 *   # 或
 *   node "packages/shared-api/scripts/smoke.mjs"
 */
import assert from 'node:assert/strict'
import { dispatchMock } from '@smart-home/api/mock'

let passed = 0

/**
 * 断言辅助：打印通过项。
 * @param {string} name
 * @param {Function} fn
 */
async function test(name, fn) {
  try {
    await fn()
    passed += 1
    console.log(`  ✓ ${name}`)
  } catch (error) {
    console.error(`  ✗ ${name}`)
    console.error(`    ${error.message}`)
    throw error
  }
}

/**
 * 发起 Mock 请求并返回 { code, message, data } 业务包。
 * @param {Object} request
 * @returns {Promise<{ code: number, message: string, data: any }>}
 */
async function call(request) {
  const response = await dispatchMock({
    method: request.method,
    url: request.url,
    params: request.params || {},
    data: request.data === undefined ? null : request.data,
    headers: request.headers || {}
  })
  return response.data
}

/**
 * 断言成功并返回 data。
 * @param {Object} request
 * @returns {Promise<any>}
 */
async function ok(request) {
  const body = await call(request)
  assert.equal(body.code, 0, `${request.method} ${request.url} 应成功，实际：${body.code} ${body.message}`)
  return body.data
}

/**
 * 断言业务失败并返回错误码。
 * @param {Object} request
 * @param {number} expectedCode
 * @returns {Promise<number>}
 */
async function expectFail(request, expectedCode) {
  const body = await call(request)
  assert.notEqual(body.code, 0, `${request.method} ${request.url} 应失败但成功了`)
  if (expectedCode) assert.equal(body.code, expectedCode, `期望错误码 ${expectedCode}，实际 ${body.code}`)
  return body.code
}

const DEMO_PHONE = '13800138000'
const DEMO_CODE = '1234'

console.log('\n[1/8] 登录 / 鉴权')
let customerToken = ''
let staffToken = ''
await test('演示顾客登录成功并已入住 305', async () => {
  const data = await ok({ method: 'POST', url: '/auth/login', data: { phone: DEMO_PHONE, code: DEMO_CODE } })
  assert.match(data.token, /^mock-token-/)
  assert.equal(data.user.real_name, '张小明')
  assert.equal(data.user.current_room_id, 'R305')
  customerToken = data.token
})
await test('错误验证码被拒绝（1002）', async () => {
  await expectFail({ method: 'POST', url: '/auth/login', data: { phone: DEMO_PHONE, code: '0000' } }, 1002)
})
const customerHeaders = () => ({ Authorization: `Bearer ${customerToken}` })
await test('员工按角色登录成功（店长）', async () => {
  const data = await ok({ method: 'POST', url: '/auth/staff-login', data: { role: 'store_manager' } })
  assert.equal(data.user.role, 'store_manager')
  staffToken = data.token
})
const staffHeaders = () => ({ Authorization: `Bearer ${staffToken}` })

console.log('\n[2/8] 客房 / 房态')
let roomCount = 0
await test('门店与房型数据齐全', async () => {
  const stores = await ok({ method: 'GET', url: '/stores' })
  assert.equal(stores.length, 1)
  assert.equal(stores[0].id, 'ST001')
  const types = await ok({ method: 'GET', url: '/room-types' })
  assert.equal(types.length, 5)
})
await test('50 间客房与 5 种房态图例', async () => {
  const data = await ok({ method: 'GET', url: '/rooms', params: { store_id: 'ST001' } })
  roomCount = data.total
  assert.equal(roomCount, 50)
  assert.equal(data.status_legend.length, 5)
})
await test('非法房态流转被拦截（2002）', async () => {
  await expectFail(
    { method: 'PATCH', url: '/rooms/R301/status', data: { status: 'vacant_ready' }, headers: staffHeaders() },
    2002
  )
})
await test('保洁完成：脏房 → 可售', async () => {
  const rooms = await ok({ method: 'GET', url: '/rooms', params: { status: 'dirty' } })
  assert.ok(rooms.total > 0, '演示数据应包含脏房')
  const target = rooms.list[0]
  const room = await ok({ method: 'POST', url: `/rooms/${target.id}/clean`, headers: staffHeaders() })
  assert.equal(room.status, 'vacant_ready')
})

console.log('\n[3/8] 订单状态机链路')
let roomTypeId
let availableRoomId
await test('房型可售查询', async () => {
  const data = await ok({ method: 'GET', url: '/rooms/availability' })
  const available = data.list.find((item) => item.available_count > 0)
  assert.ok(available, '应存在可售房型')
  roomTypeId = available.id
})
await test('创建订单 → 待支付，房间锁定为已预订', async () => {
  const order = await ok({
    method: 'POST',
    url: '/orders',
    data: {
      room_type_id: roomTypeId,
      check_in_time: '2026-11-01',
      check_out_time: '2026-11-03',
      guest_name: '张小明',
      guest_phone: DEMO_PHONE
    },
    headers: customerHeaders()
  })
  assert.equal(order.status, 'pending_payment')
  assert.equal(order.nights, 2)
  availableRoomId = order.room_id
  const room = await ok({ method: 'GET', url: `/rooms/${order.room_id}` })
  assert.equal(room.status, 'reserved')
  // 保存到模块级变量供后续步骤使用
  globalThis.__smokeOrderId = order.id
})
await test('支付 → 已确认（Mock 支付回调）', async () => {
  const order = await ok({
    method: 'POST',
    url: `/orders/${globalThis.__smokeOrderId}/pay`,
    headers: customerHeaders()
  })
  assert.equal(order.status, 'confirmed')
  assert.ok(order.paid_at)
})
await test('办理入住 → 已入住，绑定房间 + 激活设备控制权', async () => {
  const order = await ok({
    method: 'POST',
    url: `/orders/${globalThis.__smokeOrderId}/check-in`,
    headers: customerHeaders()
  })
  assert.equal(order.status, 'checked_in')
  const profile = await ok({ method: 'GET', url: '/auth/profile', headers: customerHeaders() })
  assert.equal(profile.current_room_id, availableRoomId)
  const room = await ok({ method: 'GET', url: `/rooms/${availableRoomId}` })
  assert.equal(room.status, 'occupied')
})
await test('非法重复入住被拦截', async () => {
  await expectFail(
    { method: 'POST', url: `/orders/${globalThis.__smokeOrderId}/check-in`, headers: customerHeaders() },
    4002
  )
})

console.log('\n[4/8] 设备控制')
let smokeLightId = ''
await test('房间设备为 4 路且属性完整', async () => {
  const devices = await ok({
    method: 'GET',
    url: '/devices',
    params: { room_id: availableRoomId },
    headers: customerHeaders()
  })
  assert.equal(devices.length, 4)
  const light = devices.find((device) => device.type === 'light')
  assert.ok(light)
  smokeLightId = light.id
  assert.equal(typeof light.properties.power, 'boolean')
})
await test('下发灯光属性成功（乐观更新的接口侧）', async () => {
  const device = await ok({
    method: 'PATCH',
    url: `/devices/${smokeLightId}/properties`,
    data: { power: true, brightness: 66 },
    headers: customerHeaders()
  })
  assert.equal(device.properties.power, true)
  assert.equal(device.properties.brightness, 66)
})
await test('非本房间设备控制被拒绝（4031）', async () => {
  const other = await ok({
    method: 'GET',
    url: '/devices',
    params: { room_id: 'R301' },
    headers: customerHeaders()
  })
  const otherLight = other.find((device) => device.type === 'light')
  await expectFail(
    {
      method: 'PATCH',
      url: `/devices/${otherLight.id}/properties`,
      data: { power: true },
      headers: customerHeaders()
    },
    4031
  )
})
await test('离线设备指令下发失败（5003）', async () => {
  const offline = await ok({ method: 'GET', url: '/devices', params: { room_id: 'R310' } })
  const offlineLight = offline.find((device) => device.online_status === 'offline')
  assert.ok(offlineLight, '演示数据应包含离线设备')
  await expectFail(
    {
      method: 'PATCH',
      url: `/devices/${offlineLight.id}/properties`,
      data: { power: true },
      headers: staffHeaders()
    },
    5003
  )
})

console.log('\n[5/8] 场景一键切换')
await test('睡眠场景批量更新设备属性', async () => {
  const data = await ok({
    method: 'POST',
    url: '/scenes/SCENE_SLEEP/execute',
    data: { room_id: availableRoomId },
    headers: customerHeaders()
  })
  assert.equal(data.scene.name, '睡眠模式')
  assert.equal(data.devices.length, 4)
  const light = data.devices.find((device) => device.type === 'light')
  assert.equal(light.properties.power, false)
})

console.log('\n[6/8] 订单收尾：退房 / 评价')
await test('退房 → 已完成，房间转脏房，控制权回收', async () => {
  const order = await ok({
    method: 'POST',
    url: `/orders/${globalThis.__smokeOrderId}/check-out`,
    headers: staffHeaders()
  })
  assert.equal(order.status, 'completed')
  const room = await ok({ method: 'GET', url: `/rooms/${availableRoomId}` })
  assert.equal(room.status, 'dirty')
  const profile = await ok({ method: 'GET', url: '/auth/profile', headers: customerHeaders() })
  assert.equal(profile.current_room_id, '')
})
await test('评价 → 已评价并生成评价记录', async () => {
  const data = await ok({
    method: 'POST',
    url: `/orders/${globalThis.__smokeOrderId}/review`,
    data: { rating: 5, content: '设备很智能' },
    headers: customerHeaders()
  })
  assert.equal(data.status, 'reviewed')
  assert.equal(data.review.rating, 5)
})

console.log('\n[7/8] 看板 / 告警 / 能耗')
await test('经营看板指标与趋势', async () => {
  const overview = await ok({ method: 'GET', url: '/dashboard/overview', headers: staffHeaders() })
  assert.equal(overview.room_total, 50)
  assert.ok(overview.revenue_today > 0)
  assert.ok(overview.occupancy_rate > 0 && overview.occupancy_rate < 1)
  const trend = await ok({ method: 'GET', url: '/dashboard/trend', params: { days: 7 }, headers: staffHeaders() })
  assert.equal(trend.list.length, 7)
  const distribution = await ok({
    method: 'GET',
    url: '/dashboard/room-status-distribution',
    headers: staffHeaders()
  })
  assert.equal(distribution.list.length, 5)
  const energy = await ok({ method: 'GET', url: '/energy/summary', headers: staffHeaders() })
  assert.equal(energy.series.length, 30)
  assert.ok(energy.totals.cost > 0)
})
await test('告警处理：3 条 → 处理后待处理数减少', async () => {
  const data = await ok({ method: 'GET', url: '/alarms', headers: staffHeaders() })
  assert.equal(data.pending, 3)
  const target = data.list[0]
  const alarm = await ok({ method: 'POST', url: `/alarms/${target.id}/handle`, headers: staffHeaders() })
  assert.equal(alarm.status, 'handled')
  const after = await ok({ method: 'GET', url: '/alarms', headers: staffHeaders() })
  assert.equal(after.pending, 2)
})

console.log('\n[8/8] 升级方案 / 财务')
await test('方案生成 → 提交 → 店长审批', async () => {
  const catalog = await ok({ method: 'GET', url: '/plans/catalog', headers: staffHeaders() })
  assert.equal(catalog.scopes.length, 3)
  assert.equal(catalog.tiers.length, 3)
  const plan = await ok({
    method: 'POST',
    url: '/plans/generate',
    data: { scope: 'floor', tier: 'comfort' },
    headers: staffHeaders()
  })
  assert.ok(plan.total_price > 0)
  assert.equal(plan.status, 'draft')
  const submitted = await ok({ method: 'POST', url: `/plans/${plan.id}/submit`, headers: staffHeaders() })
  assert.equal(submitted.status, 'pending_approval')
  const approved = await ok({
    method: 'POST',
    url: `/plans/${plan.id}/approve`,
    data: { approved: true, comment: '冒烟测试通过' },
    headers: staffHeaders()
  })
  assert.equal(approved.status, 'approved')
})
await test('发票列表与开票', async () => {
  const invoices = await ok({ method: 'GET', url: '/invoices', headers: staffHeaders() })
  assert.ok(invoices.total >= 6)
  const pending = invoices.list.find((invoice) => invoice.status === 'pending') || invoices.list[0]
  const issued = await ok({ method: 'POST', url: `/invoices/${pending.id}/issue`, headers: staffHeaders() })
  assert.equal(issued.status, 'issued')
})

console.log(`\n全部冒烟测试通过：${passed} 项 ✅\n`)
