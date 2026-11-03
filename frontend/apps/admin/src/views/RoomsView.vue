<script setup>
/**
 * 房态工作台：
 * - 顶部筛选（房态 / 楼层 / 关键字）+ 房态图例（含数量）；
 * - 50 间房按楼层分组的可视化网格，颜色严格取自 ROOM_STATUS_COLOR；
 * - 点击房间弹出操作弹窗：可售→标记维修、已预订→办理入住、已入住→办理退房、
 *   脏房→保洁完成、维修中→结束维修。
 *
 * 说明：入住 / 退房属于订单维度操作，若房间存在 current_order_id 则优先调用
 * orderStore.checkIn / checkOut，再刷新房态；否则回退为房态流转。
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ORDER_STATUS_TAG,
  PERMISSION,
  ROOM_STATUS_COLOR,
  ROOM_STATUS_LABEL,
  ROOM_STATUS_LEGEND,
  formatDateTime,
  formatMoney
} from '@smart-home/utils'
import { useAuthStore, useOrderStore, useRoomStore } from '@smart-home/stores'
import PageHeader from '@/components/PageHeader.vue'

const auth = useAuthStore()
const roomStore = useRoomStore()
const orderStore = useOrderStore()

const filters = reactive({
  status: '',
  floor: '',
  keyword: ''
})

const dialogVisible = ref(false)
const selectedId = ref('')
const detailLoading = ref(false)
const operating = ref('')
const dialogOrder = ref(null)

/** 是否可执行房态操作（运维角色仅可查看） */
const canOperate = computed(() => auth.can(PERMISSION.B_ROOM_OPERATE))

/** 已有楼层选项 */
const floorOptions = computed(() => {
  const floors = Array.from(new Set(roomStore.rooms.map((room) => room.floor))).sort((a, b) => a - b)
  return floors.map((floor) => ({ value: floor, label: `${floor} 楼` }))
})

/** 客户端过滤后的房间 */
const filteredRooms = computed(() => {
  const keyword = filters.keyword.trim().toLowerCase()
  return roomStore.rooms.filter((room) => {
    if (filters.status && room.status !== filters.status) return false
    if (filters.floor && String(room.floor) !== String(filters.floor)) return false
    if (keyword) {
      const text = [room.room_no, room.type_name, room.guest_name].join(' ').toLowerCase()
      if (!text.includes(keyword)) return false
    }
    return true
  })
})

/** 按楼层分组（保持楼层升序、房号升序） */
const floorGroups = computed(() => {
  const groups = []
  filteredRooms.value
    .slice()
    .sort((a, b) => a.room_no.localeCompare(b.room_no))
    .forEach((room) => {
      let group = groups.find((item) => item.floor === room.floor)
      if (!group) {
        group = { floor: room.floor, rooms: [] }
        groups.push(group)
      }
      group.rooms.push(room)
    })
  return groups.sort((a, b) => a.floor - b.floor)
})

/** 图例（数量基于全部房间，不随筛选变化） */
const legend = computed(() => {
  const counts = roomStore.statusCounts
  return ROOM_STATUS_LEGEND.map((item) => ({ ...item, count: counts[item.status] || 0 }))
})

/** 当前弹窗房间（优先使用详情接口返回的数据，含 devices） */
const dialogRoom = computed(() => {
  if (!selectedId.value) return null
  const current = roomStore.current
  if (current && current.id === selectedId.value) return current
  return roomStore.rooms.find((room) => room.id === selectedId.value) || null
})

/** 当前房间可执行的房态操作 */
const roomActions = computed(() => {
  const room = dialogRoom.value
  if (!room || !canOperate.value) return []
  switch (room.status) {
    case 'vacant_ready':
      return [
        {
          key: 'maintenance',
          label: '标记维修',
          type: 'warning',
          icon: 'Tools',
          confirm: '确认将该房间标记为「维修中」？标记后不再对外售卖。'
        }
      ]
    case 'reserved':
      return [
        {
          key: 'checkIn',
          label: '办理入住',
          type: 'primary',
          icon: 'Key',
          confirm: '确认为该房间办理入住？办理后房态变为「已入住」并激活设备控制权。'
        }
      ]
    case 'occupied':
      return [
        {
          key: 'checkOut',
          label: '办理退房',
          type: 'warning',
          icon: 'SwitchButton',
          confirm: '确认为该房间办理退房？退房后房态变为「脏房」。'
        }
      ]
    case 'dirty':
      return [{ key: 'clean', label: '保洁完成', type: 'success', icon: 'Brush' }]
    case 'maintenance':
      return [{ key: 'finishMaintenance', label: '结束维修', type: 'success', icon: 'CircleCheck' }]
    default:
      return []
  }
})

/** 当前订单状态标签 */
const dialogOrderTag = computed(() => {
  if (!dialogOrder.value) return 'info'
  return ORDER_STATUS_TAG[dialogOrder.value.status] || 'info'
})

/** 已预订房间若订单未支付 / 非待入住，则不可直接办理入住 */
const checkInBlocked = computed(() => {
  const room = dialogRoom.value
  if (!room || room.status !== 'reserved' || !room.current_order_id) return ''
  const status = room.order_status
  if (['confirmed', 'awaiting_checkin', 'paid'].includes(status)) return ''
  return `当前关联订单状态为「${room.order_status_label || '未知'}」，需支付 / 确认后才能办理入住`
})

/**
 * 加载房态列表。
 * @param {{ silent?: boolean }} [options]
 * @returns {Promise<void>}
 */
async function loadRooms(options = {}) {
  try {
    await roomStore.fetchRooms()
  } catch (error) {
    if (!options.silent) ElMessage.error(error.message || '房态加载失败')
  }
}

/**
 * 打开房间操作弹窗，并加载房间详情 / 当前订单。
 * @param {Object} room
 * @returns {Promise<void>}
 */
async function openRoom(room) {
  selectedId.value = room.id
  dialogVisible.value = true
  dialogOrder.value = null
  detailLoading.value = true
  try {
    await roomStore.fetchRoom(room.id)
    if (room.current_order_id) {
      const order = await orderStore.fetchOrder(room.current_order_id)
      dialogOrder.value = order
    }
  } catch (error) {
    ElMessage.error(error.message || '房间详情加载失败')
  } finally {
    detailLoading.value = false
  }
}

/**
 * 执行房态 / 订单操作。
 * @param {Object} action 操作定义
 * @returns {Promise<void>}
 */
async function executeAction(action) {
  const room = dialogRoom.value
  if (!room || !action || operating.value) return

  if (action.key === 'checkIn' && checkInBlocked.value) {
    ElMessage.warning(checkInBlocked.value)
    return
  }

  if (action.confirm) {
    try {
      await ElMessageBox.confirm(action.confirm, action.label, {
        confirmButtonText: '确定执行',
        cancelButtonText: '取消',
        type: 'warning'
      })
    } catch (error) {
      return
    }
  }

  operating.value = action.key
  try {
    if (action.key === 'maintenance') {
      await roomStore.markMaintenance(room.id)
      ElMessage.success(`房间 ${room.room_no} 已标记为维修中`)
    } else if (action.key === 'clean' || action.key === 'finishMaintenance') {
      await roomStore.cleanRoom(room.id)
      ElMessage.success(`房间 ${room.room_no} 已恢复为可售状态`)
    } else if (action.key === 'checkIn') {
      if (room.current_order_id) {
        await orderStore.checkIn(room.current_order_id)
        ElMessage.success(`房间 ${room.room_no} 办理入住成功`)
      } else {
        await roomStore.changeStatus(room.id, 'occupied')
        ElMessage.success(`房间 ${room.room_no} 房态已改为已入住`)
      }
    } else if (action.key === 'checkOut') {
      if (room.current_order_id) {
        await orderStore.checkOut(room.current_order_id)
        ElMessage.success(`房间 ${room.room_no} 办理退房成功，房态转为脏房`)
      } else {
        await roomStore.changeStatus(room.id, 'dirty')
        ElMessage.success(`房间 ${room.room_no} 房态已改为脏房`)
      }
    }
    await afterOperate(room.id)
  } catch (error) {
    ElMessage.error(error.message || '操作失败，请稍后重试')
  } finally {
    operating.value = ''
  }
}

/**
 * 操作成功后刷新列表与弹窗数据。
 * @param {string} roomId
 * @returns {Promise<void>}
 */
async function afterOperate(roomId) {
  await roomStore.fetchRooms()
  if (dialogVisible.value) {
    try {
      await roomStore.fetchRoom(roomId)
      const room = roomStore.current
      dialogOrder.value = null
      if (room && room.current_order_id) {
        dialogOrder.value = await orderStore.fetchOrder(room.current_order_id)
      }
    } catch (error) {
      console.warn('[rooms] 刷新房间详情失败:', error.message)
    }
  }
}

/**
 * 重置筛选条件。
 */
function resetFilters() {
  filters.status = ''
  filters.floor = ''
  filters.keyword = ''
}

onMounted(async () => {
  await loadRooms()
})
</script>

<template>
  <div class="page">
    <PageHeader
      title="房态工作台"
      icon="Grid"
      desc="50 间客房实时房态总览，支持按楼层 / 房态 / 关键字检索，点击房间可办理入住、退房、保洁与维修"
    >
      <template #actions>
        <el-button :loading="roomStore.loading" @click="loadRooms()">
          <el-icon><Refresh /></el-icon>
          <span>刷新房态</span>
        </el-button>
      </template>
    </PageHeader>

    <!-- 筛选 + 图例 -->
    <section class="panel">
      <div class="filter-bar">
        <el-select v-model="filters.status" placeholder="全部房态" clearable>
          <el-option
            v-for="item in ROOM_STATUS_LEGEND"
            :key="item.status"
            :label="item.label"
            :value="item.status"
          >
            <span class="flex">
              <span class="legend__dot" :style="{ background: item.color, '--legend-soft': `${item.color}22` }" />
              {{ item.label }}
            </span>
          </el-option>
        </el-select>

        <el-select v-model="filters.floor" placeholder="全部楼层" clearable>
          <el-option v-for="floor in floorOptions" :key="floor.value" :label="floor.label" :value="floor.value" />
        </el-select>

        <el-input v-model="filters.keyword" placeholder="搜索房号 / 房型 / 住客姓名" clearable style="width: 240px">
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>

        <el-button @click="resetFilters">
          <el-icon><RefreshLeft /></el-icon>
          <span>重置</span>
        </el-button>

        <span class="filter-bar__spacer" />
        <span class="filter-bar__summary">
          共筛选出<strong>{{ filteredRooms.length }}</strong>间 / 全店 {{ roomStore.rooms.length }} 间
        </span>
      </div>

      <div class="legend legend--bar">
        <span v-for="item in legend" :key="item.status" class="legend__item">
          <span class="legend__dot" :style="{ background: item.color, '--legend-soft': `${item.color}22` }" />
          {{ item.label }}
          <span class="legend__count">{{ item.count }}</span>
        </span>
      </div>
    </section>

    <!-- 楼层房态网格 -->
    <section v-loading="roomStore.loading" class="floor-area">
      <div v-for="group in floorGroups" :key="group.floor" class="floor-block">
        <div class="floor-block__head">
          <span class="floor-block__no">{{ group.floor }}F</span>
          <span class="floor-block__label">{{ group.floor }} 楼 · 共 {{ group.rooms.length }} 间</span>
          <span class="floor-block__line" />
        </div>

        <div class="room-grid">
          <button
            v-for="room in group.rooms"
            :key="room.id"
            type="button"
            class="room-card"
            :style="{
              '--room-color': ROOM_STATUS_COLOR[room.status],
              '--room-soft': `${ROOM_STATUS_COLOR[room.status]}12`
            }"
            @click="openRoom(room)"
          >
            <div class="room-card__top">
              <span class="room-card__no">{{ room.room_no }}</span>
              <span class="room-card__badge">{{ room.status_label }}</span>
            </div>
            <p class="room-card__type">{{ room.type_name }}</p>
            <p class="room-card__guest">
              <template v-if="room.guest_name">
                {{ room.guest_name }}
                <span v-if="room.order_status_label">· {{ room.order_status_label }}</span>
              </template>
              <template v-else>暂无住客</template>
            </p>
            <div class="room-card__foot">
              <span class="room-card__price">{{ formatMoney(room.price, { digits: 0 }) }}</span>
              <span v-if="room.current_order_id" class="room-card__order">
                <el-icon :size="11"><Tickets /></el-icon>
              </span>
            </div>
          </button>
        </div>
      </div>

      <div v-if="!roomStore.loading && !floorGroups.length" class="empty-block">
        <el-icon :size="30" style="color: #b9c6d8"><Search /></el-icon>
        <p>没有匹配的房间，试试调整筛选条件</p>
      </div>
    </section>

    <!-- 房间操作弹窗 -->
    <el-dialog v-model="dialogVisible" width="720px" top="6vh" destroy-on-close>
      <template #header>
        <div class="dialog-title">
          <span class="dialog-title__no">{{ dialogRoom && dialogRoom.room_no }}</span>
          <div class="dialog-title__meta">
            <strong>{{ dialogRoom && dialogRoom.type_name }}</strong>
            <span class="text-small text-muted">{{ dialogRoom && dialogRoom.floor }} 楼 · 门市价 {{ formatMoney(dialogRoom && dialogRoom.price, { digits: 0 }) }}</span>
          </div>
          <el-tag
            v-if="dialogRoom"
            size="small"
            effect="dark"
            :style="{ background: ROOM_STATUS_COLOR[dialogRoom.status], borderColor: ROOM_STATUS_COLOR[dialogRoom.status] }"
          >
            {{ ROOM_STATUS_LABEL[dialogRoom.status] }}
          </el-tag>
        </div>
      </template>

      <div v-if="dialogRoom" v-loading="detailLoading" class="dialog-body">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="房号">{{ dialogRoom.room_no }}</el-descriptions-item>
          <el-descriptions-item label="楼层">{{ dialogRoom.floor }} 楼</el-descriptions-item>
          <el-descriptions-item label="房型">{{ dialogRoom.type_name }}</el-descriptions-item>
          <el-descriptions-item label="房价">{{ formatMoney(dialogRoom.price) }} / 晚</el-descriptions-item>
          <el-descriptions-item label="客人">{{ dialogRoom.guest_name || '—' }}</el-descriptions-item>
          <el-descriptions-item label="联系电话">{{ dialogRoom.guest_phone || '—' }}</el-descriptions-item>
          <el-descriptions-item label="入住时间">{{ dialogRoom.check_in_time || '—' }}</el-descriptions-item>
          <el-descriptions-item label="离店时间">{{ dialogRoom.check_out_time || '—' }}</el-descriptions-item>
          <el-descriptions-item label="房态">
            <el-tag size="small" :color="ROOM_STATUS_COLOR[dialogRoom.status]" effect="dark" style="border: none">
              {{ dialogRoom.status_label }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="当前订单状态">
            <el-tag v-if="dialogRoom.order_status_label" size="small" type="warning" effect="light">
              {{ dialogRoom.order_status_label }}
            </el-tag>
            <span v-else class="text-muted">无关联订单</span>
          </el-descriptions-item>
        </el-descriptions>

        <!-- 当前订单 -->
        <div v-if="dialogOrder" class="dialog-section">
          <div class="dialog-section__head">
            <h4>当前订单</h4>
            <el-tag size="small" :type="dialogOrderTag" effect="light">{{ dialogOrder.status_label }}</el-tag>
          </div>
          <div class="order-mini">
            <div class="order-mini__cell">
              <span>订单号</span>
              <strong class="mono">{{ dialogOrder.order_no }}</strong>
            </div>
            <div class="order-mini__cell">
              <span>金额</span>
              <strong class="text-number">{{ formatMoney(dialogOrder.amount) }}</strong>
            </div>
            <div class="order-mini__cell">
              <span>间夜</span>
              <strong>{{ dialogOrder.nights }} 晚</strong>
            </div>
            <div class="order-mini__cell">
              <span>下单时间</span>
              <strong class="text-small">{{ formatDateTime(dialogOrder.created_at) }}</strong>
            </div>
          </div>
        </div>

        <!-- 房间设备 -->
        <div class="dialog-section">
          <div class="dialog-section__head">
            <h4>房间设备</h4>
            <span class="text-small text-muted">共 {{ (dialogRoom.devices || []).length }} 台</span>
          </div>
          <div v-if="(dialogRoom.devices || []).length" class="device-chips">
            <div v-for="device in dialogRoom.devices" :key="device.id" class="device-chip">
              <span class="dot" :class="device.online_status === 'online' ? 'dot--online' : 'dot--offline'" />
              <span class="device-chip__name">{{ device.type_label }}</span>
              <span class="device-chip__more">{{ device.online_label }}</span>
            </div>
          </div>
          <p v-else class="text-small text-muted">暂无设备数据</p>
        </div>

        <el-alert
          v-if="checkInBlocked"
          type="warning"
          :closable="false"
          show-icon
          :title="checkInBlocked"
        />

        <el-alert
          v-if="!canOperate"
          type="info"
          :closable="false"
          show-icon
          title="当前角色仅可查看房态，办理入住 / 退房 / 保洁 / 维修需要前台或店长权限"
        />
      </div>

      <template #footer>
        <div class="dialog-footer">
          <span class="text-small text-muted">
            <el-icon :size="12"><InfoFilled /></el-icon>
            房态流转规则：可售 → 已预订 → 已入住 → 脏房 → 维修中 → 可售
          </span>
          <div class="flex">
            <el-button @click="dialogVisible = false">关闭</el-button>
            <el-button
              v-for="action in roomActions"
              :key="action.key"
              :type="action.type"
              :loading="operating === action.key"
              :disabled="Boolean(operating) || (action.key === 'checkIn' && Boolean(checkInBlocked))"
              @click="executeAction(action)"
            >
              <el-icon><component :is="action.icon" /></el-icon>
              <span>{{ action.label }}</span>
            </el-button>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.legend--bar {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px dashed var(--border-light);
}

.floor-area {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 200px;
}

.floor-block {
  background: var(--card-bg);
  border-radius: var(--radius-card);
  padding: 16px 18px 18px;
  box-shadow: var(--shadow-card);
  border: 1px solid rgba(229, 234, 243, 0.7);
}

.floor-block__head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.floor-block__no {
  width: 44px;
  height: 30px;
  border-radius: 9px;
  background: linear-gradient(135deg, #1677ff, #57a1ff);
  color: #fff;
  font-family: var(--font-number);
  font-size: 15px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  letter-spacing: 0.5px;
  box-shadow: 0 6px 14px rgba(22, 119, 255, 0.26);
}

.floor-block__label {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.floor-block__line {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, var(--border-light), transparent);
}

.room-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(152px, 1fr));
  gap: 12px;
}

.room-card {
  position: relative;
  text-align: left;
  font-family: inherit;
  cursor: pointer;
  border: 1px solid #e7edf6;
  border-left: 4px solid var(--room-color);
  background: linear-gradient(180deg, var(--room-soft), #ffffff 62%);
  border-radius: 12px;
  padding: 12px 13px 10px;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  overflow: hidden;
}

.room-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 24px rgba(31, 45, 61, 0.12);
  border-color: var(--room-color);
}

.room-card:active {
  transform: translateY(-1px);
}

.room-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.room-card__no {
  font-family: var(--font-number);
  font-size: 20px;
  font-weight: 700;
  color: var(--room-color);
  letter-spacing: 1px;
  line-height: 1.1;
}

.room-card__badge {
  flex-shrink: 0;
  padding: 1px 7px;
  border-radius: 20px;
  background: var(--room-color);
  color: #fff;
  font-size: 10.5px;
  font-weight: 500;
  opacity: 0.92;
}

.room-card__type {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--text-regular);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.room-card__guest {
  margin: 4px 0 0;
  font-size: 11px;
  color: var(--text-secondary);
  min-height: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.room-card__foot {
  margin-top: 8px;
  padding-top: 7px;
  border-top: 1px dashed rgba(229, 234, 243, 0.9);
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--text-secondary);
}

.room-card__price {
  font-family: var(--font-number);
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-regular);
}

.room-card__order {
  color: var(--brand);
  display: inline-flex;
}

.dialog-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dialog-title__no {
  font-family: var(--font-number);
  font-size: 24px;
  font-weight: 700;
  color: var(--brand);
  letter-spacing: 1px;
}

.dialog-title__meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.3;
}

.dialog-title__meta strong {
  font-size: 14px;
  color: var(--text-main);
}

.dialog-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dialog-section {
  border: 1px solid var(--border-light);
  border-radius: 12px;
  padding: 12px 14px;
  background: #fbfcfe;
}

.dialog-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.dialog-section__head h4 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main);
}

.order-mini {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.order-mini__cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.order-mini__cell span {
  font-size: 11px;
  color: var(--text-secondary);
}

.order-mini__cell strong {
  font-size: 12.5px;
  color: var(--text-main);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.device-chips {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.device-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 9px;
  background: #fff;
  border: 1px solid var(--border-light);
  font-size: 12px;
  color: var(--text-regular);
}

.device-chip__name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.device-chip__more {
  font-size: 10.5px;
  color: var(--text-secondary);
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.dialog-footer .text-small {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.empty-block p {
  margin: 10px 0 0;
}

@media (max-width: 1200px) {
  .device-chips {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .order-mini {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
