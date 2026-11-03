<script setup>
/**
 * 确认订单页：日期 + 入住人 + 备注 → orderStore.createOrder。
 *
 * 路由参数：room_type_id、check_in_time、check_out_time（可选）
 * 实名校验：未实名时提示前往「实名与入住」页，可继续下单（入住前必须完成实名）。
 */
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useAuthStore, useOrderStore, useRoomStore } from '@smart-home/stores'
import {
  addDays,
  diffDays,
  formatMoney,
  isDateRangeValid,
  isPhone,
  today
} from '@smart-home/utils'
import { ROUTES, ensureLoggedIn, navigate, replace } from '@/utils/nav'
import { confirmAction, errorMessage, toast, toastSuccess } from '@/utils/ui'

const authStore = useAuthStore()
const orderStore = useOrderStore()
const roomStore = useRoomStore()

/** 房型 id */
const roomTypeId = ref('')
/** 入住日期 */
const checkIn = ref(today())
/** 离店日期 */
const checkOut = ref(addDays(today(), 1))
/** 入住人 */
const guestName = ref('')
/** 入住人手机号 */
const guestPhone = ref('')
/** 备注 */
const remark = ref('')
/** 页面加载态 */
const loading = ref(false)
/** 提交中 */
const submitting = ref(false)

/** 房型信息 */
const roomType = computed(
  () =>
    roomStore.availability.find((item) => item.id === roomTypeId.value) ||
    roomStore.roomTypes.find((item) => item.id === roomTypeId.value) ||
    null
)

/** 间夜数 */
const nights = computed(() => diffDays(checkIn.value, checkOut.value))

/** 预计房费 */
const totalAmount = computed(() => {
  const price = roomType.value ? Number(roomType.value.price) || 0 : 0
  return price * nights.value
})

/** 是否已实名 */
const isVerified = computed(() => authStore.isVerified)

/** 离店日期最小值 */
const minCheckOut = computed(() => addDays(checkIn.value, 1))

/**
 * 加载房型与默认入住人信息。
 * @returns {Promise<void>}
 */
async function loadData() {
  loading.value = true
  try {
    if (!roomStore.roomTypes.length) await roomStore.fetchRoomTypes()
    await roomStore.fetchAvailability({
      check_in_time: checkIn.value,
      check_out_time: checkOut.value
    })
  } catch (error) {
    toast(errorMessage(error, '订单信息加载失败'))
  } finally {
    loading.value = false
  }
}

onLoad((options = {}) => {
  if (!ensureLoggedIn()) return
  roomTypeId.value = options.room_type_id || ''
  if (options.check_in_time) checkIn.value = options.check_in_time
  if (options.check_out_time) checkOut.value = options.check_out_time
  // 默认带入当前用户实名信息
  guestName.value = (authStore.user && authStore.user.real_name) || ''
  guestPhone.value = (authStore.user && authStore.user.phone) || ''
  loadData()
})

/**
 * 入住日期变化。
 * @param {Object} event
 * @returns {void}
 */
function onCheckInChange(event) {
  checkIn.value = event.detail.value
  if (checkOut.value <= checkIn.value) checkOut.value = addDays(checkIn.value, 1)
  loadData()
}

/**
 * 离店日期变化。
 * @param {Object} event
 * @returns {void}
 */
function onCheckOutChange(event) {
  if (event.detail.value <= checkIn.value) {
    toast('离店日期需晚于入住日期')
    return
  }
  checkOut.value = event.detail.value
  loadData()
}

/**
 * 去实名认证。
 * @returns {void}
 */
function goRealName() {
  navigate(ROUTES.CHECKIN)
}

/**
 * 提交订单。
 * @returns {Promise<void>}
 */
async function submitOrder() {
  if (submitting.value) return
  if (!roomType.value) {
    toast('房型信息加载中，请稍候')
    return
  }
  if (!isDateRangeValid(checkIn.value, checkOut.value)) {
    toast('离店日期需晚于入住日期')
    return
  }
  if (!guestName.value.trim()) {
    toast('请填写入住人姓名')
    return
  }
  if (guestPhone.value.trim() && !isPhone(guestPhone.value)) {
    toast('请输入正确的入住人手机号')
    return
  }

  // 未实名：先提示去认证（可选择继续下单，入住前完成认证即可）
  if (!isVerified.value) {
    const goVerify = await confirmAction({
      title: '尚未实名认证',
      content: '办理入住前需要完成实名认证，是否现在前往认证？',
      confirmText: '去认证',
      cancelText: '继续下单'
    })
    if (goVerify) {
      goRealName()
      return
    }
  }

  submitting.value = true
  try {
    const order = await orderStore.createOrder({
      room_type_id: roomType.value.id,
      check_in_time: checkIn.value,
      check_out_time: checkOut.value,
      guest_name: guestName.value.trim(),
      guest_phone: guestPhone.value.trim() || (authStore.user && authStore.user.phone) || '',
      remark: remark.value.trim()
    })
    toastSuccess('下单成功')
    setTimeout(() => replace(`${ROUTES.ORDER_DETAIL}?id=${order.id}`), 400)
  } catch (error) {
    toast(errorMessage(error, '下单失败，请稍后重试'))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="page page--padded create">
    <view v-if="!roomType && loading" class="loading-line">正在加载订单信息...</view>

    <template v-else>
      <!-- 未实名提示 -->
      <view v-if="!isVerified" class="verify-banner" @click="goRealName">
        <text class="verify-banner__icon">🪪</text>
        <view class="verify-banner__content">
          <text class="verify-banner__title">尚未完成实名认证</text>
          <text class="verify-banner__desc">办理入住前需完成实名，点击前往认证</text>
        </view>
        <text class="verify-banner__arrow">›</text>
      </view>

      <!-- 房型信息 -->
      <view v-if="roomType" class="room-card card">
        <view class="room-card__cover" :style="{ background: roomType.cover_color || '#1677FF' }">
          <text class="room-card__name">{{ roomType.name }}</text>
          <text class="room-card__meta">{{ roomType.bed_type }} · {{ roomType.area }}㎡ · 可住 {{ roomType.capacity }} 人</text>
        </view>
        <view class="room-card__body">
          <view class="room-card__row">
            <text class="room-card__label">每晚价格</text>
            <text class="room-card__value">{{ formatMoney(roomType.price) }}</text>
          </view>
          <view class="room-card__row">
            <text class="room-card__label">可售房间</text>
            <text class="room-card__value">{{ roomType.available_count }} 间</text>
          </view>
        </view>
      </view>

      <!-- 入住信息 -->
      <view class="form-card card">
        <text class="form-card__title">入住信息</text>

        <view class="form-row">
          <text class="form-row__label">入住日期</text>
          <picker mode="date" :value="checkIn" :start="today()" @change="onCheckInChange">
            <view class="form-row__picker">{{ checkIn }} <text class="form-row__arrow">▾</text></view>
          </picker>
        </view>

        <view class="form-row">
          <text class="form-row__label">离店日期</text>
          <picker mode="date" :value="checkOut" :start="minCheckOut" @change="onCheckOutChange">
            <view class="form-row__picker">{{ checkOut }} <text class="form-row__arrow">▾</text></view>
          </picker>
        </view>

        <view class="form-row">
          <text class="form-row__label">入住晚数</text>
          <text class="form-row__static">{{ nights }} 晚</text>
        </view>

        <view class="form-row">
          <text class="form-row__label">入住人</text>
          <input
            v-model="guestName"
            class="form-row__input"
            type="text"
            maxlength="20"
            placeholder="请填写入住人姓名"
            placeholder-class="form-row__placeholder"
          />
        </view>

        <view class="form-row">
          <text class="form-row__label">手机号</text>
          <input
            v-model="guestPhone"
            class="form-row__input"
            type="number"
            maxlength="11"
            placeholder="请填写入住人手机号"
            placeholder-class="form-row__placeholder"
          />
        </view>

        <view class="form-row form-row--textarea">
          <text class="form-row__label">备注</text>
          <textarea
            v-model="remark"
            class="form-row__textarea"
            maxlength="100"
            placeholder="如有特殊需求可备注（选填）"
            placeholder-class="form-row__placeholder"
          />
        </view>
      </view>

      <!-- 费用明细 -->
      <view class="amount-card card">
        <view class="amount-card__row">
          <text class="amount-card__label">房费（{{ formatMoney(roomType && roomType.price, { digits: 0 }) }} × {{ nights }} 晚）</text>
          <text class="amount-card__value">{{ formatMoney(totalAmount) }}</text>
        </view>
        <view class="amount-card__row">
          <text class="amount-card__label">服务费</text>
          <text class="amount-card__value">已包含</text>
        </view>
        <view class="amount-card__divider" />
        <view class="amount-card__row amount-card__row--total">
          <text class="amount-card__total-label">应付金额</text>
          <text class="amount-card__total">{{ formatMoney(totalAmount) }}</text>
        </view>
      </view>

      <view class="create__tip">提交后房间将被锁定，请在 30 分钟内完成支付</view>
      <view class="create__spacer" />

      <!-- 底部提交栏 -->
      <view class="footer-bar create__footer">
        <view class="create__footer-price">
          <text class="create__footer-label">应付</text>
          <text class="create__footer-amount">{{ formatMoney(totalAmount) }}</text>
        </view>
        <button class="primary-btn create__footer-btn" :loading="submitting" :disabled="submitting" @click="submitOrder">
          {{ submitting ? '提交中...' : '提交订单' }}
        </button>
      </view>
    </template>
  </view>
</template>

<style scoped>
.create {
  padding-bottom: calc(env(safe-area-inset-bottom) + 170rpx);
}

.verify-banner {
  display: flex;
  align-items: center;
  gap: 18rpx;
  margin-bottom: 24rpx;
  padding: 24rpx;
  border: 2rpx solid #ffe7ba;
  border-radius: 24rpx;
  background: #fffbe6;
}

.verify-banner__icon {
  font-size: 40rpx;
}

.verify-banner__content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.verify-banner__title {
  font-size: 26rpx;
  font-weight: 600;
  color: #ad6800;
}

.verify-banner__desc {
  font-size: 21rpx;
  color: #ad8b00;
}

.verify-banner__arrow {
  color: #d4a017;
  font-size: 32rpx;
}

.room-card {
  overflow: hidden;
}

.room-card__cover {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 30rpx 28rpx;
  color: #ffffff;
}

.room-card__name {
  font-size: 34rpx;
  font-weight: 700;
}

.room-card__meta {
  font-size: 22rpx;
  opacity: 0.88;
}

.room-card__body {
  padding: 22rpx 28rpx;
}

.room-card__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8rpx 0;
}

.room-card__label {
  font-size: 24rpx;
  color: #8c8c8c;
}

.room-card__value {
  font-size: 24rpx;
  font-weight: 600;
}

.form-card {
  margin-top: 24rpx;
  padding: 28rpx;
}

.form-card__title {
  font-size: 30rpx;
  font-weight: 600;
}

.form-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 88rpx;
  border-bottom: 2rpx solid #f4f6fa;
}

.form-row__label {
  flex-shrink: 0;
  width: 150rpx;
  font-size: 25rpx;
  color: #6b7280;
}

.form-row__picker {
  font-size: 26rpx;
  font-weight: 600;
  text-align: right;
}

.form-row__arrow {
  color: #1677ff;
  font-size: 20rpx;
}

.form-row__static {
  font-size: 26rpx;
  font-weight: 600;
}

.form-row__input {
  flex: 1;
  min-width: 0;
  height: 88rpx;
  text-align: right;
  font-size: 26rpx;
}

.form-row__placeholder {
  color: #bfbfbf;
}

.form-row--textarea {
  align-items: flex-start;
  padding: 24rpx 0;
  border-bottom: none;
}

.form-row__textarea {
  flex: 1;
  min-width: 0;
  height: 120rpx;
  font-size: 25rpx;
  line-height: 1.6;
}

.amount-card {
  margin-top: 24rpx;
  padding: 28rpx;
}

.amount-card__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8rpx 0;
}

.amount-card__label {
  font-size: 24rpx;
  color: #8c8c8c;
}

.amount-card__value {
  font-size: 24rpx;
}

.amount-card__divider {
  height: 2rpx;
  margin: 16rpx 0;
  background: #f1f4f8;
}

.amount-card__row--total {
  align-items: baseline;
}

.amount-card__total-label {
  font-size: 26rpx;
  font-weight: 600;
}

.amount-card__total {
  font-size: 40rpx;
  font-weight: 700;
  color: #fa541c;
}

.create__tip {
  margin-top: 24rpx;
  text-align: center;
  font-size: 21rpx;
  color: #a6adb8;
}

.create__spacer {
  height: 20rpx;
}

.create__footer {
  justify-content: space-between;
}

.create__footer-price {
  display: flex;
  flex-direction: column;
}

.create__footer-label {
  font-size: 20rpx;
  color: #8c8c8c;
}

.create__footer-amount {
  font-size: 36rpx;
  font-weight: 700;
  color: #fa541c;
}

.create__footer-btn {
  width: 320rpx;
  padding: 24rpx 0;
}
</style>
