<script setup>
/**
 * 我的订单：状态筛选 chips + 订单列表。
 *
 * 数据：useOrderStore.fetchOrders({ self: '1', status? })
 * 状态筛选值全部来自 shared-utils 的 ORDER_STATUS / ORDER_STATUS_LABEL。
 */
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { useOrderStore } from '@smart-home/stores'
import { ORDER_STATUS, ORDER_STATUS_LABEL } from '@smart-home/utils'
import OrderCard from '@/components/OrderCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import { ROUTES, ensureLoggedIn, navigate } from '@/utils/nav'
import { errorMessage, toast } from '@/utils/ui'

const orderStore = useOrderStore()

/** 状态筛选项（全部 + 主要状态节点） */
const FILTERS = [
  { value: '', label: '全部' },
  { value: ORDER_STATUS.PENDING_PAYMENT, label: ORDER_STATUS_LABEL[ORDER_STATUS.PENDING_PAYMENT] },
  { value: ORDER_STATUS.CONFIRMED, label: ORDER_STATUS_LABEL[ORDER_STATUS.CONFIRMED] },
  { value: ORDER_STATUS.AWAITING_CHECKIN, label: ORDER_STATUS_LABEL[ORDER_STATUS.AWAITING_CHECKIN] },
  { value: ORDER_STATUS.CHECKED_IN, label: ORDER_STATUS_LABEL[ORDER_STATUS.CHECKED_IN] },
  { value: ORDER_STATUS.COMPLETED, label: ORDER_STATUS_LABEL[ORDER_STATUS.COMPLETED] },
  { value: ORDER_STATUS.REVIEWED, label: ORDER_STATUS_LABEL[ORDER_STATUS.REVIEWED] },
  { value: ORDER_STATUS.CANCELLED, label: ORDER_STATUS_LABEL[ORDER_STATUS.CANCELLED] }
]

/** 当前筛选状态 */
const activeStatus = ref('')
/** 加载态 */
const loading = ref(false)

/** 订单列表 */
const orders = computed(() => orderStore.list)

/**
 * 加载当前筛选条件下的订单。
 * @returns {Promise<void>}
 */
async function loadOrders() {
  loading.value = true
  try {
    // Mock 接口对 self 做严格字符串比较，这里传 '1'（已向 Lead 反馈对齐问题）
    const params = { self: '1', page: 1, page_size: 50 }
    if (activeStatus.value) params.status = activeStatus.value
    await orderStore.fetchOrders(params)
  } catch (error) {
    toast(errorMessage(error, '订单加载失败'))
  } finally {
    loading.value = false
  }
}

onShow(() => {
  if (!ensureLoggedIn()) return
  loadOrders()
})

onPullDownRefresh(async () => {
  if (ensureLoggedIn()) await loadOrders()
  uni.stopPullDownRefresh()
})

/**
 * 切换状态筛选。
 * @param {string} status
 * @returns {void}
 */
function changeFilter(status) {
  if (activeStatus.value === status) return
  activeStatus.value = status
  loadOrders()
}

/**
 * 打开订单详情。
 * @param {Object} order
 * @returns {void}
 */
function openOrder(order) {
  navigate(`${ROUTES.ORDER_DETAIL}?id=${order.id}`)
}
</script>

<template>
  <view class="page orders">
    <!-- 状态筛选 -->
    <scroll-view class="orders__filters" scroll-x :show-scrollbar="false">
      <view class="orders__filters-inner">
        <view
          v-for="item in FILTERS"
          :key="item.value || 'all'"
          class="filter-chip"
          :class="{ 'filter-chip--active': activeStatus === item.value }"
          @click="changeFilter(item.value)"
        >
          {{ item.label }}
        </view>
      </view>
    </scroll-view>

    <view class="orders__body">
      <view v-if="loading && !orders.length" class="loading-line">正在加载订单...</view>

      <view v-else-if="orders.length">
        <OrderCard v-for="order in orders" :key="order.id" :order="order" @click="openOrder" />
        <view class="orders__total">共 {{ orderStore.total }} 笔订单</view>
      </view>

      <view v-else class="orders__empty card">
        <EmptyState
          icon="📋"
          description="该状态下暂无订单"
          action-text="去预订客房"
          @action="navigate(ROUTES.ROOMS)"
        />
      </view>
    </view>
  </view>
</template>

<style scoped>
.orders {
  padding-bottom: 40rpx;
}

.orders__filters {
  position: sticky;
  top: 0;
  z-index: 10;
  width: 100%;
  white-space: nowrap;
  background: #f5f7fa;
}

.orders__filters-inner {
  display: inline-flex;
  gap: 16rpx;
  padding: 20rpx 24rpx;
}

.filter-chip {
  flex-shrink: 0;
  padding: 12rpx 30rpx;
  border-radius: 999rpx;
  background: #ffffff;
  color: #6b7280;
  font-size: 24rpx;
  box-shadow: 0 6rpx 20rpx rgba(22, 60, 120, 0.04);
}

.filter-chip--active {
  background: linear-gradient(135deg, #1677ff 0%, #4096ff 100%);
  color: #ffffff;
  font-weight: 600;
  box-shadow: 0 10rpx 24rpx rgba(22, 119, 255, 0.28);
}

.orders__body {
  padding: 8rpx 24rpx 0;
}

.orders__total {
  margin-top: 28rpx;
  text-align: center;
  font-size: 21rpx;
  color: #a6adb8;
}

.orders__empty {
  margin-top: 8rpx;
}
</style>
