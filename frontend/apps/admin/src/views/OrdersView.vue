<script setup>
/**
 * 订单管理：
 * - 状态 / 关键字筛选 + 分页表格；
 * - 操作按钮统一由 getOrderActions(status, 'staff') 生成（禁止页面硬编码状态）；
 * - 详情抽屉含订单时间轴（fetchTimeline）、金额明细、备注与退款原因。
 */
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TAG,
  PERMISSION,
  formatDateTime,
  formatMoney,
  getOrderActions
} from '@smart-home/utils'
import { useAuthStore, useOrderStore } from '@smart-home/stores'
import PageHeader from '@/components/PageHeader.vue'

const route = useRoute()
const auth = useAuthStore()
const orderStore = useOrderStore()

const filters = reactive({
  status: '',
  keyword: typeof route.query.keyword === 'string' ? route.query.keyword : ''
})

const page = ref(1)
const pageSize = ref(10)
const drawerVisible = ref(false)
const detailLoading = ref(false)
const operating = ref('')
const activeOrder = ref(null)

/** 是否可操作订单（财务角色仅查看） */
const canOperate = computed(() => auth.can(PERMISSION.B_ORDER_OPERATE))

/** 状态筛选项 */
const statusOptions = Object.entries(ORDER_STATUS_LABEL).map(([value, label]) => ({ value, label }))

/** 列表当前行可用操作（按 staff 端过滤） */
function rowActions(row) {
  return getOrderActions(row.status, 'staff')
}

/** 详情抽屉当前订单可用操作 */
const detailActions = computed(() => {
  if (!activeOrder.value) return []
  return getOrderActions(activeOrder.value.status, 'staff')
})

/** 时间轴（过滤掉无时间的占位节点，展示完整状态轨迹） */
const timeline = computed(() => orderStore.timeline.filter((step) => step.time))

/**
 * 加载订单列表。
 * @returns {Promise<void>}
 */
async function loadOrders() {
  try {
    await orderStore.fetchOrders({
      status: filters.status || undefined,
      keyword: filters.keyword.trim() || undefined,
      page: page.value,
      page_size: pageSize.value
    })
  } catch (error) {
    ElMessage.error(error.message || '订单加载失败')
  }
}

/**
 * 搜索（重置到第一页）。
 */
function handleSearch() {
  page.value = 1
  loadOrders()
}

/**
 * 重置筛选。
 */
function resetFilters() {
  filters.status = ''
  filters.keyword = ''
  page.value = 1
  loadOrders()
}

/**
 * 分页大小变化。
 * @param {number} size
 */
function handleSizeChange(size) {
  pageSize.value = size
  page.value = 1
  loadOrders()
}

/**
 * 打开订单详情抽屉。
 * @param {Object} row
 * @returns {Promise<void>}
 */
async function openDetail(row) {
  drawerVisible.value = true
  detailLoading.value = true
  activeOrder.value = row
  try {
    const [order] = await Promise.all([orderStore.fetchOrder(row.id), orderStore.fetchTimeline(row.id)])
    activeOrder.value = order
  } catch (error) {
    ElMessage.error(error.message || '订单详情加载失败')
  } finally {
    detailLoading.value = false
  }
}

/**
 * 执行订单操作。
 * @param {{ action: string, label: string, confirm: boolean }} action
 * @param {Object} order
 * @returns {Promise<void>}
 */
async function runAction(action, order) {
  if (!action || !order || operating.value) return
  if (action.confirm) {
    try {
      await ElMessageBox.confirm(
        `确定为订单 ${order.order_no} 执行「${action.label}」操作吗？`,
        action.label,
        { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
      )
    } catch (error) {
      return
    }
  }

  operating.value = action.action
  try {
    if (action.action === 'checkIn') {
      await orderStore.checkIn(order.id)
    } else if (action.action === 'checkOut') {
      await orderStore.checkOut(order.id)
    } else if (action.action === 'cancel') {
      await orderStore.cancel(order.id)
    } else if (action.action === 'confirmRefund') {
      await orderStore.confirmRefund(order.id)
    } else if (action.action === 'refund') {
      await orderStore.refund(order.id)
    }
    ElMessage.success(`订单 ${order.order_no}「${action.label}」成功`)

    // 有状态筛选时重新拉取列表，保证列表与筛选条件一致
    if (filters.status) {
      await loadOrders()
    }
    if (drawerVisible.value && activeOrder.value && activeOrder.value.id === order.id) {
      activeOrder.value = orderStore.list.find((item) => item.id === order.id) || orderStore.current
      await orderStore.fetchTimeline(order.id)
    }
  } catch (error) {
    ElMessage.error(error.message || '操作失败，请稍后重试')
  } finally {
    operating.value = ''
  }
}

/** 从看板跳转过来时按订单号过滤 */
watch(
  () => route.query.keyword,
  (value) => {
    if (typeof value === 'string' && value !== filters.keyword) {
      filters.keyword = value
      page.value = 1
      loadOrders()
    }
  }
)

onMounted(loadOrders)
</script>

<template>
  <div class="page">
    <PageHeader
      title="订单管理"
      icon="Tickets"
      desc="覆盖订单状态机全链路：待支付 → 已确认 → 已入住 → 已完成，支持入住 / 退房 / 取消 / 确认退款"
    >
      <template #actions>
        <el-button :loading="orderStore.loading" @click="loadOrders">
          <el-icon><Refresh /></el-icon>
          <span>刷新</span>
        </el-button>
      </template>
    </PageHeader>

    <section class="panel">
      <div class="filter-bar">
        <el-select v-model="filters.status" placeholder="全部状态" clearable @change="handleSearch">
          <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-input
          v-model="filters.keyword"
          placeholder="订单号 / 房号 / 客人 / 手机号"
          clearable
          style="width: 240px"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-button type="primary" @click="handleSearch">
          <el-icon><Search /></el-icon>
          <span>查询</span>
        </el-button>
        <el-button @click="resetFilters">
          <el-icon><RefreshLeft /></el-icon>
          <span>重置</span>
        </el-button>
        <span class="filter-bar__spacer" />
        <span class="filter-bar__summary">共<strong>{{ orderStore.total }}</strong>笔订单</span>
      </div>
    </section>

    <section class="panel panel--flush">
      <el-table v-loading="orderStore.loading" :data="orderStore.list" style="width: 100%" row-key="id">
        <el-table-column label="订单号" min-width="170">
          <template #default="{ row }">
            <div class="flex-col" style="gap: 3px">
              <span class="code-chip">{{ row.order_no }}</span>
              <span class="text-small text-muted">
                {{ row.source === 'frontdesk' ? '前台下单' : '顾客 App' }}
              </span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="房型 / 房号" min-width="140">
          <template #default="{ row }">
            <div class="flex-col" style="gap: 3px">
              <span class="text-strong">{{ row.type_name }}</span>
              <span class="text-small text-muted">
                <span class="room-no-text">{{ row.room_no }}</span> 房 · {{ row.nights }} 晚
              </span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="客人" min-width="120">
          <template #default="{ row }">
            <div class="flex-col" style="gap: 3px">
              <span>{{ row.guest_name }}</span>
              <span class="text-small text-muted mono">{{ row.guest_phone }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="金额" width="104" align="right">
          <template #default="{ row }">
            <span class="text-number text-strong">{{ formatMoney(row.amount) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="状态" width="96" align="center">
          <template #default="{ row }">
            <el-tag :type="ORDER_STATUS_TAG[row.status] || 'info'" size="small" effect="light">
              {{ row.status_label }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="入住 / 离店" min-width="160">
          <template #default="{ row }">
            <div class="flex-col" style="gap: 3px">
              <span class="text-small"><span class="text-muted">入</span> {{ row.check_in_time }}</span>
              <span class="text-small"><span class="text-muted">离</span> {{ row.check_out_time }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="创建时间" width="138">
          <template #default="{ row }">
            <span class="text-small text-muted">{{ formatDateTime(row.created_at) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="190" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <template v-if="canOperate">
                <el-button
                  v-for="action in rowActions(row)"
                  :key="action.action"
                  size="small"
                  :type="action.type"
                  :loading="operating === action.action"
                  @click.stop="runAction(action, row)"
                >
                  {{ action.label }}
                </el-button>
              </template>
              <el-button size="small" text type="primary" @click.stop="openDetail(row)">详情</el-button>
              <el-tooltip v-if="!canOperate" content="当前角色仅可查看订单，无操作权限" placement="top">
                <el-icon class="text-muted" :size="14"><Lock /></el-icon>
              </el-tooltip>
            </div>
          </template>
        </el-table-column>

        <template #empty>
          <div class="empty-block">
            <el-icon :size="28" style="color: #b9c6d8"><Tickets /></el-icon>
            <p>暂无符合条件的订单</p>
          </div>
        </template>
      </el-table>

      <div class="pagination-bar">
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="orderStore.total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @current-change="loadOrders"
          @size-change="handleSizeChange"
        />
      </div>
    </section>

    <!-- 订单详情抽屉 -->
    <el-drawer v-model="drawerVisible" size="520px" title="订单详情" destroy-on-close>
      <div v-loading="detailLoading" class="order-detail">
        <template v-if="activeOrder">
          <div class="order-detail__hero">
            <div>
              <span class="text-small text-muted">订单号</span>
              <p class="order-detail__no">{{ activeOrder.order_no }}</p>
            </div>
            <el-tag :type="ORDER_STATUS_TAG[activeOrder.status] || 'info'" effect="light">
              {{ activeOrder.status_label }}
            </el-tag>
          </div>

          <div class="amount-card">
            <span>订单金额</span>
            <strong>{{ formatMoney(activeOrder.amount) }}</strong>
            <small>{{ activeOrder.price ? `${formatMoney(activeOrder.price)} × ${activeOrder.nights} 晚` : '' }}</small>
          </div>

          <el-descriptions :column="2" border size="small" class="mt-12">
            <el-descriptions-item label="房间 / 房型">
              <span class="room-no-text">{{ activeOrder.room_no }}</span> · {{ activeOrder.type_name }}
            </el-descriptions-item>
            <el-descriptions-item label="来源">
              {{ activeOrder.source === 'frontdesk' ? '前台下单' : '顾客 App' }}
            </el-descriptions-item>
            <el-descriptions-item label="入住人">{{ activeOrder.guest_name }}</el-descriptions-item>
            <el-descriptions-item label="联系电话">
              <span class="mono">{{ activeOrder.guest_phone }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="入住时间">{{ activeOrder.check_in_time }}</el-descriptions-item>
            <el-descriptions-item label="离店时间">{{ activeOrder.check_out_time }}</el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ activeOrder.created_at }}</el-descriptions-item>
            <el-descriptions-item label="支付时间">{{ activeOrder.paid_at || '—' }}</el-descriptions-item>
          </el-descriptions>

          <el-alert
            v-if="activeOrder.refund_reason"
            class="mt-12"
            type="warning"
            :closable="false"
            show-icon
            :title="`退款原因：${activeOrder.refund_reason}`"
          />

          <div class="detail-section">
            <h4>状态时间轴</h4>
            <el-timeline v-if="timeline.length" class="mt-8">
              <el-timeline-item
                v-for="(step, index) in timeline"
                :key="step.status"
                :timestamp="formatDateTime(step.time)"
                placement="top"
                :type="index === timeline.length - 1 ? 'primary' : 'success'"
                :hollow="index !== timeline.length - 1"
              >
                <div class="timeline-text">
                  <strong>{{ step.label }}</strong>
                  <span class="text-small text-muted">{{ step.time }}</span>
                </div>
              </el-timeline-item>
            </el-timeline>
            <p v-else class="text-small text-muted">暂无时间轴数据</p>
          </div>

          <div class="detail-section">
            <h4>订单备注</h4>
            <p class="text-small" style="line-height: 1.7">
              {{ activeOrder.remark || '无备注' }}
            </p>
          </div>

          <div v-if="detailActions.length" class="drawer-actions">
            <el-button
              v-for="action in detailActions"
              :key="action.action"
              :type="action.type"
              :loading="operating === action.action"
              @click="runAction(action, activeOrder)"
            >
              {{ action.label }}
            </el-button>
          </div>
          <el-alert
            v-else-if="!canOperate"
            type="info"
            :closable="false"
            show-icon
            title="当前角色仅可查看订单，操作需前台或店长权限"
          />
        </template>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped>
.pagination-bar {
  display: flex;
  justify-content: flex-end;
  padding: 14px 18px;
  border-top: 1px solid var(--border-light);
}

.empty-block p {
  margin: 8px 0 0;
}

.order-detail {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.order-detail__hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border-light);
}

.order-detail__no {
  margin: 4px 0 0;
  font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-main);
}

.amount-card {
  margin-top: 14px;
  padding: 16px 18px;
  border-radius: 12px;
  background: linear-gradient(135deg, #f0f6ff, #fbfdff);
  border: 1px solid #e0edff;
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}

.amount-card span {
  font-size: 12px;
  color: var(--text-secondary);
}

.amount-card strong {
  font-family: var(--font-number);
  font-size: 26px;
  color: var(--brand);
  font-weight: 700;
}

.amount-card small {
  font-size: 11.5px;
  color: var(--text-placeholder);
}

.detail-section {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px dashed var(--border-light);
}

.detail-section h4 {
  margin: 0 0 10px;
  font-size: 14px;
  color: var(--text-main);
}

.timeline-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.timeline-text strong {
  font-size: 13px;
  color: var(--text-main);
}

.drawer-actions {
  margin-top: 22px;
  padding-top: 16px;
  border-top: 1px solid var(--border-light);
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
</style>
