<script setup>
/**
 * 订单详情：订单信息 + 状态时间轴 + 状态机操作按钮 + 评价。
 *
 * - 操作按钮完全由 `orderStore.availableActions`（getOrderActions）驱动，页面不硬编码状态流转；
 * - 支付 / 取消 / 退款 / 入住 / 退房 / 评价统一走 useOrderStore actions；
 * - 操作成功后刷新订单与时间轴；入住 / 退房后同步刷新用户资料（current_room_id）。
 */
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useAuthStore, useOrderStore } from '@smart-home/stores'
import {
  ORDER_STATUS_COLOR,
  ORDER_STATUS_LABEL,
  formatDateTime,
  formatMoney,
  maskPhone
} from '@smart-home/utils'
import { ROUTES, ensureLoggedIn, navigate } from '@/utils/nav'
import { confirmAction, errorMessage, toast, toastSuccess } from '@/utils/ui'

const authStore = useAuthStore()
const orderStore = useOrderStore()

/** 订单 id */
const orderId = ref('')
/** 页面加载态 */
const loading = ref(false)
/** 正在提交的操作名（按钮 loading） */
const submittingAction = ref('')
/** 评价弹层是否可见 */
const reviewVisible = ref(false)
/** 评价星级 */
const reviewRating = ref(5)
/** 评价内容 */
const reviewContent = ref('')

/** 当前订单 */
const order = computed(() => orderStore.current)
/** 可执行操作（状态机 + 角色端过滤） */
const actions = computed(() => orderStore.availableActions)
/** 状态时间轴 */
const timeline = computed(() => orderStore.timeline)

/** 状态文案 */
const statusLabel = computed(() => {
  if (!order.value) return ''
  return order.value.status_label || ORDER_STATUS_LABEL[order.value.status] || ''
})

/** 状态主色 */
const statusColor = computed(() => {
  if (!order.value) return '#1677FF'
  return ORDER_STATUS_COLOR[order.value.status] || '#1677FF'
})

/** 状态头图渐变 */
const statusGradient = computed(
  () => `linear-gradient(135deg, ${statusColor.value} 0%, ${statusColor.value}c9 60%, ${statusColor.value}8c 100%)`
)

/** 是否可控制设备（接口字段 can_control_devices） */
const canControlDevices = computed(() => Boolean(order.value && order.value.can_control_devices))

/** 操作成功后的提示文案（按操作名区分，非状态文案） */
const ACTION_SUCCESS_TIP = {
  pay: '支付成功',
  cancel: '订单已取消',
  refund: '退款申请已提交',
  checkIn: '入住成功',
  checkOut: '退房成功',
  confirmRefund: '退款已完成',
  review: '评价成功'
}

/** 评价星级选项 */
const ratingOptions = [1, 2, 3, 4, 5]

/**
 * 加载订单详情 + 时间轴。
 * @returns {Promise<void>}
 */
async function loadDetail() {
  if (!orderId.value) return
  loading.value = true
  try {
    await Promise.all([orderStore.fetchOrder(orderId.value), orderStore.fetchTimeline(orderId.value)])
  } catch (error) {
    toast(errorMessage(error, '订单详情加载失败'))
  } finally {
    loading.value = false
  }
}

/**
 * 刷新订单 + 时间轴（操作成功后调用）。
 * @returns {Promise<void>}
 */
async function refreshDetail() {
  await Promise.all([orderStore.fetchOrder(orderId.value), orderStore.fetchTimeline(orderId.value)])
}

onLoad((options = {}) => {
  if (!ensureLoggedIn()) return
  orderId.value = options.id || ''
  if (!orderId.value) {
    toast('缺少订单参数')
    setTimeout(() => uni.navigateBack(), 600)
    return
  }
  loadDetail()
})

/**
 * 根据操作类型构造按钮样式。
 * @param {{ type: string }} action
 * @returns {string}
 */
function actionClass(action) {
  if (action.type === 'primary') return 'primary-btn detail__action detail__action--primary'
  return 'ghost-btn detail__action'
}

/**
 * 根据操作类型构造次要按钮的强调色。
 * @param {{ type: string }} action
 * @returns {Object}
 */
function actionStyle(action) {
  if (action.type === 'primary') return {}
  const colorMap = {
    warning: '#fa8c16',
    danger: '#f5222d',
    success: '#52c41a',
    info: '#6b7280'
  }
  const color = colorMap[action.type] || '#1677ff'
  return { color, borderColor: `${color}44`, background: `${color}0f` }
}

/**
 * 执行订单操作。
 * @param {{ action: string, label: string, type: string, confirm: boolean }} action
 * @returns {Promise<void>}
 */
async function handleAction(action) {
  if (submittingAction.value) return
  if (action.action === 'review') {
    reviewRating.value = 5
    reviewContent.value = ''
    reviewVisible.value = true
    return
  }
  if (action.confirm) {
    const confirmed = await confirmAction({
      title: '操作确认',
      content: `确定要「${action.label}」吗？`,
      confirmText: action.label
    })
    if (!confirmed) return
  }

  submittingAction.value = action.action
  try {
    if (action.action === 'pay') await orderStore.pay(order.value.id)
    else if (action.action === 'cancel') await orderStore.cancel(order.value.id)
    else if (action.action === 'refund') await orderStore.refund(order.value.id, '顾客申请退款')
    else if (action.action === 'checkIn') await orderStore.checkIn(order.value.id)
    else if (action.action === 'checkOut') await orderStore.checkOut(order.value.id)
    else if (action.action === 'confirmRefund') await orderStore.confirmRefund(order.value.id)

    toastSuccess(ACTION_SUCCESS_TIP[action.action] || '操作成功')

    // 入住 / 退房会变更 users.current_room_id，需要同步刷新登录用户
    if (action.action === 'checkIn' || action.action === 'checkOut') {
      await authStore.fetchProfile().catch(() => null)
    }
    await refreshDetail()
  } catch (error) {
    toast(errorMessage(error, '操作失败，请稍后重试'))
  } finally {
    submittingAction.value = ''
  }
}

/**
 * 提交评价。
 * @returns {Promise<void>}
 */
async function submitReview() {
  if (submittingAction.value) return
  submittingAction.value = 'review'
  try {
    await orderStore.review(order.value.id, {
      rating: reviewRating.value,
      content: reviewContent.value.trim()
    })
    reviewVisible.value = false
    toastSuccess(ACTION_SUCCESS_TIP.review)
    await refreshDetail()
  } catch (error) {
    toast(errorMessage(error, '评价失败，请稍后重试'))
  } finally {
    submittingAction.value = ''
  }
}

/**
 * 关闭评价弹层。
 * @returns {void}
 */
function closeReview() {
  reviewVisible.value = false
}
</script>

<template>
  <view class="page detail-page">
    <view v-if="!order" class="loading-line">正在加载订单详情...</view>

    <template v-else>
      <!-- 状态头图 -->
      <view class="status-hero" :style="{ background: statusGradient }">
        <view class="status-hero__shine" />
        <text class="status-hero__label">当前状态</text>
        <text class="status-hero__status">{{ statusLabel }}</text>
        <text class="status-hero__no">订单号 {{ order.order_no }}</text>
      </view>

      <view class="detail-page__body">
        <!-- 订单基础信息 -->
        <view class="info-card card">
          <view class="info-card__room">
            <view class="info-card__room-left">
              <text class="info-card__room-no">{{ order.room_no }} 房</text>
              <text class="info-card__room-type">{{ order.type_name }}</text>
            </view>
            <view class="info-card__price">{{ formatMoney(order.amount) }}</view>
          </view>

          <view class="info-row">
            <text class="info-row__label">入住时间</text>
            <text class="info-row__value">{{ formatDateTime(order.check_in_time) }}</text>
          </view>
          <view class="info-row">
            <text class="info-row__label">离店时间</text>
            <text class="info-row__value">{{ formatDateTime(order.check_out_time) }}</text>
          </view>
          <view class="info-row">
            <text class="info-row__label">入住晚数</text>
            <text class="info-row__value">{{ order.nights }} 晚</text>
          </view>
          <view class="info-row">
            <text class="info-row__label">入住人</text>
            <text class="info-row__value">{{ order.guest_name }}</text>
          </view>
          <view class="info-row">
            <text class="info-row__label">联系电话</text>
            <text class="info-row__value">{{ maskPhone(order.guest_phone) }}</text>
          </view>
          <view class="info-row">
            <text class="info-row__label">下单时间</text>
            <text class="info-row__value">{{ formatDateTime(order.created_at) }}</text>
          </view>
          <view v-if="order.remark" class="info-row">
            <text class="info-row__label">备注</text>
            <text class="info-row__value info-row__value--wrap">{{ order.remark }}</text>
          </view>
        </view>

        <!-- 设备控制权提示 -->
        <view v-if="canControlDevices" class="device-entry card" @click="navigate(ROUTES.DEVICE)">
          <text class="device-entry__icon">🎛️</text>
          <view class="device-entry__content">
            <text class="device-entry__title">设备控制权已激活</text>
            <text class="device-entry__desc">灯光、空调、窗帘、电视已可一键控制</text>
          </view>
          <text class="device-entry__arrow">›</text>
        </view>

        <!-- 状态时间轴 -->
        <view class="timeline-card card">
          <text class="timeline-card__title">订单进度</text>
          <view class="timeline">
            <view v-for="(step, index) in timeline" :key="step.status" class="timeline__item">
              <view class="timeline__rail">
                <view
                  class="timeline__dot"
                  :style="{
                    background: step.time ? ORDER_STATUS_COLOR[step.status] || '#1677FF' : '#e6eaf0',
                    boxShadow: step.time ? `0 0 0 8rpx ${(ORDER_STATUS_COLOR[step.status] || '#1677FF')}1a` : 'none'
                  }"
                />
                <view v-if="index < timeline.length - 1" class="timeline__line" :class="{ 'timeline__line--done': step.time }" />
              </view>
              <view class="timeline__content">
                <text class="timeline__label" :class="{ 'timeline__label--pending': !step.time }">{{ step.label }}</text>
                <text class="timeline__time">{{ step.time ? formatDateTime(step.time) : '待完成' }}</text>
              </view>
            </view>
          </view>
        </view>

        <view class="detail-page__spacer" />
      </view>

      <!-- 底部操作栏：完全由 availableActions 驱动 -->
      <view class="footer-bar detail-page__footer">
        <view v-if="!actions.length" class="detail-page__footer-hint">
          当前状态：{{ statusLabel }}
        </view>
        <button
          v-for="action in actions"
          :key="action.action"
          :class="actionClass(action)"
          :style="actionStyle(action)"
          :loading="submittingAction === action.action"
          :disabled="Boolean(submittingAction)"
          @click="handleAction(action)"
        >
          {{ action.label }}
        </button>
      </view>

      <!-- 评价弹层 -->
      <view v-if="reviewVisible" class="review-mask" @click="closeReview">
        <view class="review-sheet" @click.stop>
          <text class="review-sheet__title">评价本次入住</text>
          <view class="review-sheet__stars">
            <text
              v-for="star in ratingOptions"
              :key="star"
              class="review-sheet__star"
              :class="{ 'review-sheet__star--active': star <= reviewRating }"
              @click="reviewRating = star"
            >
              ★
            </text>
          </view>
          <text class="review-sheet__score">{{ reviewRating }} 分</text>
          <textarea
            v-model="reviewContent"
            class="review-sheet__input"
            maxlength="120"
            placeholder="说说本次入住的体验（选填）"
            placeholder-class="review-sheet__placeholder"
          />
          <button
            class="primary-btn review-sheet__submit"
            :loading="submittingAction === 'review'"
            :disabled="submittingAction === 'review'"
            @click="submitReview"
          >
            提交评价
          </button>
        </view>
      </view>
    </template>
  </view>
</template>

<style scoped>
.detail-page {
  padding-bottom: calc(env(safe-area-inset-bottom) + 160rpx);
}

.status-hero {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 44rpx 32rpx 56rpx;
  color: #ffffff;
  overflow: hidden;
}

.status-hero__shine {
  position: absolute;
  top: -140rpx;
  right: -100rpx;
  width: 380rpx;
  height: 380rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.16);
}

.status-hero__label {
  font-size: 22rpx;
  opacity: 0.75;
}

.status-hero__status {
  font-size: 52rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
}

.status-hero__no {
  font-size: 22rpx;
  opacity: 0.78;
}

.detail-page__body {
  padding: 0 24rpx;
  margin-top: -32rpx;
}

.info-card {
  padding: 28rpx;
}

.info-card__room {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 20rpx;
  border-bottom: 2rpx solid #f1f4f8;
}

.info-card__room-left {
  display: flex;
  align-items: baseline;
  gap: 16rpx;
}

.info-card__room-no {
  font-size: 40rpx;
  font-weight: 700;
}

.info-card__room-type {
  font-size: 24rpx;
  color: #8c8c8c;
}

.info-card__price {
  font-size: 36rpx;
  font-weight: 700;
  color: #fa541c;
}

.info-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24rpx;
  padding: 16rpx 0;
}

.info-row__label {
  flex-shrink: 0;
  font-size: 24rpx;
  color: #8c8c8c;
}

.info-row__value {
  font-size: 25rpx;
  color: #1f1f1f;
  text-align: right;
}

.info-row__value--wrap {
  word-break: break-all;
}

.device-entry {
  display: flex;
  align-items: center;
  gap: 18rpx;
  margin-top: 24rpx;
  padding: 26rpx 28rpx;
  border: 2rpx solid #d6e4ff;
  background: linear-gradient(135deg, #f0f6ff 0%, #e8f1ff 100%);
}

.device-entry__icon {
  font-size: 44rpx;
}

.device-entry__content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.device-entry__title {
  font-size: 27rpx;
  font-weight: 600;
  color: #1677ff;
}

.device-entry__desc {
  font-size: 21rpx;
  color: #5c7ba8;
}

.device-entry__arrow {
  font-size: 34rpx;
  color: #1677ff;
}

.timeline-card {
  margin-top: 24rpx;
  padding: 28rpx;
}

.timeline-card__title {
  font-size: 30rpx;
  font-weight: 600;
}

.timeline {
  margin-top: 24rpx;
}

.timeline__item {
  display: flex;
  gap: 20rpx;
}

.timeline__rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 24rpx;
  flex-shrink: 0;
}

.timeline__dot {
  width: 18rpx;
  height: 18rpx;
  margin-top: 8rpx;
  border-radius: 50%;
}

.timeline__line {
  flex: 1;
  width: 3rpx;
  min-height: 44rpx;
  margin: 6rpx 0;
  background: #eef1f6;
}

.timeline__line--done {
  background: #bcd8ff;
}

.timeline__content {
  flex: 1;
  min-width: 0;
  padding-bottom: 26rpx;
}

.timeline__label {
  font-size: 26rpx;
  font-weight: 600;
  color: #1f1f1f;
}

.timeline__label--pending {
  color: #bfbfbf;
  font-weight: 400;
}

.timeline__time {
  display: block;
  margin-top: 4rpx;
  font-size: 21rpx;
  color: #a6adb8;
}

.detail-page__spacer {
  height: 20rpx;
}

.detail-page__footer {
  gap: 16rpx;
  justify-content: flex-end;
}

.detail-page__footer-hint {
  flex: 1;
  font-size: 23rpx;
  color: #8c8c8c;
}

.detail__action {
  flex: 1;
  padding: 22rpx 0;
  font-size: 27rpx;
}

.detail__action--primary {
  box-shadow: 0 10rpx 24rpx rgba(22, 119, 255, 0.26);
}

.review-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 99;
  display: flex;
  align-items: flex-end;
  background: rgba(15, 23, 42, 0.45);
}

.review-sheet {
  width: 100%;
  padding: 36rpx 32rpx calc(env(safe-area-inset-bottom) + 32rpx);
  border-radius: 36rpx 36rpx 0 0;
  background: #ffffff;
}

.review-sheet__title {
  font-size: 32rpx;
  font-weight: 700;
}

.review-sheet__stars {
  display: flex;
  justify-content: center;
  gap: 20rpx;
  margin-top: 28rpx;
}

.review-sheet__star {
  font-size: 64rpx;
  color: #e6eaf0;
  line-height: 1;
}

.review-sheet__star--active {
  color: #faad14;
}

.review-sheet__score {
  display: block;
  margin-top: 10rpx;
  text-align: center;
  font-size: 24rpx;
  color: #8c8c8c;
}

.review-sheet__input {
  width: 100%;
  height: 180rpx;
  margin-top: 24rpx;
  padding: 22rpx;
  border-radius: 20rpx;
  background: #f7f9fc;
  font-size: 25rpx;
  line-height: 1.6;
}

.review-sheet__placeholder {
  color: #bfbfbf;
}

.review-sheet__submit {
  margin-top: 28rpx;
}
</style>
