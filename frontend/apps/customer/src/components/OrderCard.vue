<script setup>
/**
 * 订单卡片（首页「进行中订单」与订单列表复用）。
 *
 * 状态文案与配色全部来自 @smart-home/utils，页面不硬编码状态中文。
 */
import { computed } from 'vue'
import { ORDER_STATUS_COLOR, ORDER_STATUS_LABEL, formatDate, formatMoney } from '@smart-home/utils'

const props = defineProps({
  /** 订单对象（shared-api enrichOrder 结构） */
  order: {
    type: Object,
    required: true
  },
  /** 是否展示订单号 */
  showOrderNo: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['click'])

/** 状态文案 */
const statusLabel = computed(() => props.order.status_label || ORDER_STATUS_LABEL[props.order.status] || props.order.status)

/** 状态主色 */
const statusColor = computed(() => ORDER_STATUS_COLOR[props.order.status] || '#8C8C8C')

/** 状态浅色底 */
const statusBackground = computed(() => `${statusColor.value}1A`)

/**
 * 点击整卡。
 * @returns {void}
 */
function handleClick() {
  emit('click', props.order)
}
</script>

<template>
  <view class="order-card" @click="handleClick">
    <view class="order-card__head">
      <view class="order-card__title">
        <text class="order-card__type">{{ order.type_name }}</text>
        <text class="order-card__room">{{ order.room_no }} 房</text>
      </view>
      <view class="order-card__status" :style="{ color: statusColor, background: statusBackground }">
        {{ statusLabel }}
      </view>
    </view>

    <view class="order-card__dates">
      <text class="order-card__date">{{ formatDate(order.check_in_time) }}</text>
      <text class="order-card__arrow">→</text>
      <text class="order-card__date">{{ formatDate(order.check_out_time) }}</text>
      <text class="order-card__nights">共 {{ order.nights }} 晚</text>
    </view>

    <view class="order-card__foot">
      <text v-if="showOrderNo" class="order-card__sn">{{ order.order_no }}</text>
      <text v-else class="order-card__sn">入住人：{{ order.guest_name }}</text>
      <text class="order-card__amount">{{ formatMoney(order.amount) }}</text>
    </view>
  </view>
</template>

<style scoped>
.order-card {
  padding: 28rpx;
  border-radius: 28rpx;
  background: #ffffff;
  box-shadow: 0 10rpx 40rpx rgba(22, 60, 120, 0.06);
}

.order-card + .order-card {
  margin-top: 20rpx;
}

.order-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.order-card__title {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  min-width: 0;
}

.order-card__type {
  font-size: 30rpx;
  font-weight: 600;
  color: #1f1f1f;
}

.order-card__room {
  font-size: 24rpx;
  color: #8c8c8c;
}

.order-card__status {
  flex-shrink: 0;
  padding: 6rpx 18rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: 600;
  line-height: 1.6;
}

.order-card__dates {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 22rpx;
  padding: 18rpx 20rpx;
  border-radius: 18rpx;
  background: #f7f9fc;
}

.order-card__date {
  font-size: 26rpx;
  color: #1f1f1f;
  font-weight: 500;
}

.order-card__arrow {
  font-size: 24rpx;
  color: #bfbfbf;
}

.order-card__nights {
  margin-left: auto;
  font-size: 22rpx;
  color: #8c8c8c;
}

.order-card__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 20rpx;
}

.order-card__sn {
  font-size: 22rpx;
  color: #8c8c8c;
}

.order-card__amount {
  font-size: 30rpx;
  font-weight: 700;
  color: #fa541c;
}
</style>
