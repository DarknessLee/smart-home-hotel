<script setup>
/**
 * 房型详情：封面渐变图 + 房型信息 + 日期选择 + 立即预订。
 *
 * 路由参数：room_type_id、check_in_time、check_out_time（可选）
 */
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useRoomStore } from '@smart-home/stores'
import {
  DEVICE_TYPE,
  DEVICE_TYPE_ICON,
  DEVICE_TYPE_LABEL,
  addDays,
  diffDays,
  formatMoney,
  today
} from '@smart-home/utils'
import { ROUTES, ensureLoggedIn, navigate } from '@/utils/nav'
import { errorMessage, toast } from '@/utils/ui'

const roomStore = useRoomStore()

/** 房型 id */
const roomTypeId = ref('')
/** 入住日期 */
const checkIn = ref(today())
/** 离店日期 */
const checkOut = ref(addDays(today(), 1))
/** 加载态 */
const loading = ref(false)

/** 全屋智能设备展示项（C 端统一配置：每间客房 4 路设备） */
const deviceShowcase = Object.values(DEVICE_TYPE).map((type) => ({
  type,
  label: DEVICE_TYPE_LABEL[type],
  icon: DEVICE_TYPE_ICON[type]
}))

/** 房型数据（优先使用可售查询结果，含 available_count） */
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

/** 是否可预订 */
const canBook = computed(() => Boolean(roomType.value && roomType.value.available_count > 0))

/** 封面渐变 */
const coverStyle = computed(() => {
  const color = (roomType.value && roomType.value.cover_color) || '#1677FF'
  return { background: `linear-gradient(150deg, ${color} 0%, ${color}c9 55%, ${color}66 100%)` }
})

/** 离店日期最小值 */
const minCheckOut = computed(() => addDays(checkIn.value, 1))

/**
 * 加载房型与可售信息。
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
    toast(errorMessage(error, '房型详情加载失败'))
  } finally {
    loading.value = false
  }
}

onLoad((options = {}) => {
  if (!ensureLoggedIn()) return
  roomTypeId.value = options.room_type_id || ''
  if (options.check_in_time) checkIn.value = options.check_in_time
  if (options.check_out_time) checkOut.value = options.check_out_time
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
 * 立即预订（带日期跳转到确认订单页）。
 * @returns {void}
 */
function bookNow() {
  if (!roomType.value) {
    toast('房型信息加载中，请稍候')
    return
  }
  if (!canBook.value) {
    toast('该日期暂无可售房间，请调整日期或更换房型')
    return
  }
  navigate(
    `${ROUTES.ORDER_CREATE}?room_type_id=${roomType.value.id}&check_in_time=${checkIn.value}&check_out_time=${checkOut.value}`
  )
}
</script>

<template>
  <view class="page detail">
    <view v-if="!roomType" class="loading-line">正在加载房型详情...</view>

    <template v-else>
      <!-- 封面 -->
      <view class="detail__cover" :style="coverStyle">
        <view class="detail__cover-shine" />
        <view class="detail__cover-content">
          <text class="detail__name">{{ roomType.name }}</text>
          <view class="detail__cover-meta">
            <text>{{ roomType.bed_type }}</text>
            <text class="detail__dot">·</text>
            <text>{{ roomType.area }}㎡</text>
            <text class="detail__dot">·</text>
            <text>可住 {{ roomType.capacity }} 人</text>
          </view>
          <view class="detail__tags">
            <text v-for="tag in roomType.tags" :key="tag" class="detail__tag">{{ tag }}</text>
          </view>
        </view>
      </view>

      <view class="detail__body">
        <!-- 价格与可售 -->
        <view class="price-card card">
          <view class="price-card__left">
            <view class="price-card__price">
              <text class="price-card__symbol">¥</text>
              <text class="price-card__num">{{ roomType.price }}</text>
              <text class="price-card__unit">/晚</text>
            </view>
            <text class="price-card__hint">含服务费 · 到店无需押金</text>
          </view>
          <view class="price-card__stock" :class="{ 'price-card__stock--empty': !roomType.available_count }">
            {{ roomType.available_count ? `剩 ${roomType.available_count} 间` : '已满房' }}
          </view>
        </view>

        <!-- 日期与预计房费 -->
        <view class="book-card card">
          <view class="book-card__dates">
            <view class="book-card__date-item">
              <text class="book-card__label">入住</text>
              <picker mode="date" :value="checkIn" :start="today()" @change="onCheckInChange">
                <view class="book-card__value">{{ checkIn }} <text class="book-card__arrow">▾</text></view>
              </picker>
            </view>
            <text class="book-card__nights">{{ nights }} 晚</text>
            <view class="book-card__date-item">
              <text class="book-card__label">离店</text>
              <picker mode="date" :value="checkOut" :start="minCheckOut" @change="onCheckOutChange">
                <view class="book-card__value">{{ checkOut }} <text class="book-card__arrow">▾</text></view>
              </picker>
            </view>
          </view>
          <view class="book-card__total">
            <text class="book-card__total-label">预计房费</text>
            <text class="book-card__total-amount">{{ formatMoney(totalAmount) }}</text>
          </view>
        </view>

        <!-- 房型介绍 -->
        <view class="info-card card">
          <text class="info-card__title">房型介绍</text>
          <text class="info-card__desc">{{ roomType.description }}</text>
          <view class="info-card__facts">
            <view class="info-card__fact">
              <text class="info-card__fact-value">{{ roomType.area }}㎡</text>
              <text class="info-card__fact-label">房间面积</text>
            </view>
            <view class="info-card__fact">
              <text class="info-card__fact-value">{{ roomType.capacity }} 人</text>
              <text class="info-card__fact-label">可住人数</text>
            </view>
            <view class="info-card__fact">
              <text class="info-card__fact-value">{{ roomType.bed_type }}</text>
              <text class="info-card__fact-label">床型</text>
            </view>
          </view>
        </view>

        <!-- 全屋智能设备 -->
        <view class="device-card card">
          <text class="info-card__title">全屋智能设备</text>
          <view class="device-card__grid">
            <view v-for="item in deviceShowcase" :key="item.type" class="device-card__item">
              <text class="device-card__icon">{{ item.icon }}</text>
              <text class="device-card__label">{{ item.label }}</text>
            </view>
          </view>
          <text class="device-card__hint">办理入住后，可在「设备」页一键控制灯光、空调、窗帘与电视</text>
        </view>

        <view class="detail__spacer" />
      </view>

      <!-- 底部预订栏 -->
      <view class="footer-bar detail__footer">
        <view class="detail__footer-price">
          <text class="detail__footer-label">合计</text>
          <text class="detail__footer-amount">{{ formatMoney(totalAmount) }}</text>
        </view>
        <button class="primary-btn detail__footer-btn" :disabled="!canBook" @click="bookNow">
          {{ canBook ? '立即预订' : '该日期已满房' }}
        </button>
      </view>
    </template>
  </view>
</template>

<style scoped>
.detail {
  padding-bottom: calc(env(safe-area-inset-bottom) + 160rpx);
}

.detail__cover {
  position: relative;
  height: 400rpx;
  padding: 0 32rpx;
  overflow: hidden;
}

.detail__cover-shine {
  position: absolute;
  top: -120rpx;
  right: -80rpx;
  width: 420rpx;
  height: 420rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.16);
}

.detail__cover-content {
  position: absolute;
  left: 32rpx;
  right: 32rpx;
  bottom: 64rpx;
  color: #ffffff;
}

.detail__name {
  font-size: 52rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
  text-shadow: 0 6rpx 20rpx rgba(0, 0, 0, 0.18);
}

.detail__cover-meta {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-top: 12rpx;
  font-size: 24rpx;
  opacity: 0.9;
}

.detail__dot {
  opacity: 0.6;
}

.detail__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 20rpx;
}

.detail__tag {
  padding: 6rpx 20rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.35);
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.16);
  font-size: 22rpx;
}

.detail__body {
  padding: 0 24rpx;
  margin-top: -36rpx;
}

.price-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx;
}

.price-card__price {
  display: flex;
  align-items: baseline;
  color: #fa541c;
}

.price-card__symbol {
  font-size: 26rpx;
  font-weight: 600;
}

.price-card__num {
  font-size: 52rpx;
  font-weight: 700;
  line-height: 1;
}

.price-card__unit {
  font-size: 22rpx;
  color: #a6adb8;
}

.price-card__hint {
  display: block;
  margin-top: 8rpx;
  font-size: 21rpx;
  color: #a6adb8;
}

.price-card__stock {
  padding: 8rpx 22rpx;
  border-radius: 999rpx;
  background: rgba(82, 196, 26, 0.1);
  color: #52c41a;
  font-size: 22rpx;
  font-weight: 600;
}

.price-card__stock--empty {
  background: rgba(140, 140, 140, 0.12);
  color: #8c8c8c;
}

.book-card {
  margin-top: 24rpx;
  padding: 28rpx;
}

.book-card__dates {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.book-card__date-item {
  flex: 1;
  min-width: 0;
}

.book-card__label {
  font-size: 21rpx;
  color: #8c8c8c;
}

.book-card__value {
  margin-top: 8rpx;
  font-size: 30rpx;
  font-weight: 600;
}

.book-card__arrow {
  color: #1677ff;
  font-size: 20rpx;
}

.book-card__nights {
  flex-shrink: 0;
  margin: 0 20rpx;
  padding: 6rpx 18rpx;
  border-radius: 999rpx;
  background: #f0f6ff;
  color: #1677ff;
  font-size: 21rpx;
}

.book-card__total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 24rpx;
  padding-top: 22rpx;
  border-top: 2rpx solid #f1f4f8;
}

.book-card__total-label {
  font-size: 24rpx;
  color: #8c8c8c;
}

.book-card__total-amount {
  font-size: 34rpx;
  font-weight: 700;
  color: #fa541c;
}

.info-card {
  margin-top: 24rpx;
  padding: 28rpx;
}

.info-card__title {
  font-size: 30rpx;
  font-weight: 600;
}

.info-card__desc {
  display: block;
  margin-top: 14rpx;
  color: #6b7280;
  font-size: 24rpx;
  line-height: 1.7;
}

.info-card__facts {
  display: flex;
  gap: 16rpx;
  margin-top: 24rpx;
}

.info-card__fact {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
  padding: 20rpx 8rpx;
  border-radius: 20rpx;
  background: #f7f9fc;
}

.info-card__fact-value {
  font-size: 26rpx;
  font-weight: 600;
  color: #1f1f1f;
}

.info-card__fact-label {
  font-size: 20rpx;
  color: #a6adb8;
}

.device-card {
  margin-top: 24rpx;
  padding: 28rpx;
}

.device-card__grid {
  display: flex;
  gap: 16rpx;
  margin-top: 22rpx;
}

.device-card__item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  padding: 22rpx 0;
  border-radius: 20rpx;
  background: #f7f9fc;
}

.device-card__icon {
  font-size: 38rpx;
}

.device-card__label {
  font-size: 21rpx;
  color: #6b7280;
}

.device-card__hint {
  display: block;
  margin-top: 18rpx;
  font-size: 21rpx;
  color: #a6adb8;
  line-height: 1.6;
}

.detail__spacer {
  height: 20rpx;
}

.detail__footer {
  justify-content: space-between;
}

.detail__footer-price {
  display: flex;
  flex-direction: column;
}

.detail__footer-label {
  font-size: 20rpx;
  color: #8c8c8c;
}

.detail__footer-amount {
  font-size: 36rpx;
  font-weight: 700;
  color: #fa541c;
}

.detail__footer-btn {
  width: 320rpx;
  padding: 24rpx 0;
}
</style>
