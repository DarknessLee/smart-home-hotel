<script setup>
/**
 * tabBar 客房页：入住 / 离店日期选择 + 房型可售列表。
 *
 * 数据：useRoomStore.fetchAvailability({ check_in_time, check_out_time })
 * 点击房型卡片进入 pages/rooms/detail。
 */
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { useRoomStore } from '@smart-home/stores'
import { addDays, diffDays, today } from '@smart-home/utils'
import EmptyState from '@/components/EmptyState.vue'
import { ROUTES, ensureLoggedIn, navigate } from '@/utils/nav'
import { errorMessage, toast } from '@/utils/ui'

const roomStore = useRoomStore()

/** 入住日期 */
const checkIn = ref(today())
/** 离店日期 */
const checkOut = ref(addDays(today(), 1))
/** 列表加载态 */
const loading = ref(false)

/** 入住日期最小值（今天） */
const minCheckIn = computed(() => today())

/** 离店日期最小值（入住次日） */
const minCheckOut = computed(() => addDays(checkIn.value, 1))

/** 间夜数 */
const nights = computed(() => diffDays(checkIn.value, checkOut.value))

/** 房型列表（含 available_count） */
const roomTypes = computed(() => roomStore.availability)

/**
 * 加载可售房型。
 * @returns {Promise<void>}
 */
async function loadAvailability() {
  loading.value = true
  try {
    await roomStore.fetchAvailability({
      check_in_time: checkIn.value,
      check_out_time: checkOut.value
    })
  } catch (error) {
    toast(errorMessage(error, '房型加载失败'))
  } finally {
    loading.value = false
  }
}

onShow(() => {
  if (!ensureLoggedIn()) return
  loadAvailability()
})

onPullDownRefresh(async () => {
  if (ensureLoggedIn()) await loadAvailability()
  uni.stopPullDownRefresh()
})

/**
 * 入住日期变化。
 * @param {Object} event picker change 事件
 * @returns {void}
 */
function onCheckInChange(event) {
  checkIn.value = event.detail.value
  if (checkOut.value <= checkIn.value) checkOut.value = addDays(checkIn.value, 1)
  loadAvailability()
}

/**
 * 离店日期变化。
 * @param {Object} event picker change 事件
 * @returns {void}
 */
function onCheckOutChange(event) {
  const value = event.detail.value
  if (value <= checkIn.value) {
    toast('离店日期需晚于入住日期')
    return
  }
  checkOut.value = value
  loadAvailability()
}

/**
 * 房型封面渐变色（无静态图片，使用 cover_color 生成渐变）。
 * @param {{ cover_color?: string }} type
 * @returns {Object}
 */
function coverStyle(type) {
  const color = type.cover_color || '#1677FF'
  return {
    background: `linear-gradient(135deg, ${color} 0%, ${color}c9 55%, ${color}7a 100%)`
  }
}

/**
 * 进入房型详情。
 * @param {Object} type
 * @returns {void}
 */
function openDetail(type) {
  navigate(
    `${ROUTES.ROOM_DETAIL}?room_type_id=${type.id}&check_in_time=${checkIn.value}&check_out_time=${checkOut.value}`
  )
}
</script>

<template>
  <view class="page page--padded rooms">
    <!-- 日期选择 -->
    <view class="date-card card">
      <view class="date-card__item">
        <text class="date-card__label">入住日期</text>
        <picker mode="date" :value="checkIn" :start="minCheckIn" @change="onCheckInChange">
          <view class="date-card__value">
            <text class="date-card__date">{{ checkIn }}</text>
            <text class="date-card__arrow">▾</text>
          </view>
        </picker>
      </view>
      <view class="date-card__divider" />
      <view class="date-card__item">
        <text class="date-card__label">离店日期</text>
        <picker mode="date" :value="checkOut" :start="minCheckOut" @change="onCheckOutChange">
          <view class="date-card__value">
            <text class="date-card__date">{{ checkOut }}</text>
            <text class="date-card__arrow">▾</text>
          </view>
        </picker>
      </view>
      <view class="date-card__nights">共 {{ nights }} 晚</view>
    </view>

    <view class="section-head">
      <text class="section-title">可预订房型</text>
      <text class="section-more">{{ roomTypes.length }} 种房型</text>
    </view>

    <view v-if="loading && !roomTypes.length" class="loading-line">正在查询可售房型...</view>

    <view v-else-if="roomTypes.length">
      <view
        v-for="type in roomTypes"
        :key="type.id"
        class="room-type card"
        @click="openDetail(type)"
      >
        <view class="room-type__cover" :style="coverStyle(type)">
          <view class="room-type__cover-shine" />
          <text class="room-type__cover-name">{{ type.name }}</text>
          <view class="room-type__cover-meta">{{ type.bed_type }} · {{ type.area }}㎡</view>
          <view class="room-type__price">
            <text class="room-type__price-symbol">¥</text>
            <text class="room-type__price-num">{{ type.price }}</text>
            <text class="room-type__price-unit">/晚</text>
          </view>
        </view>

        <view class="room-type__body">
          <view class="room-type__head">
            <view class="room-type__specs">
              <text class="room-type__spec">可住 {{ type.capacity }} 人</text>
              <text class="room-type__dot">·</text>
              <text class="room-type__spec">{{ type.area }}㎡</text>
              <text class="room-type__dot">·</text>
              <text class="room-type__spec">{{ type.bed_type }}</text>
            </view>
            <view class="room-type__stock" :class="{ 'room-type__stock--empty': !type.available_count }">
              {{ type.available_count ? `剩 ${type.available_count} 间` : '已满房' }}
            </view>
          </view>

          <view class="room-type__tags">
            <text v-for="tag in type.tags" :key="tag" class="tag-pill">{{ tag }}</text>
          </view>

          <text class="room-type__desc">{{ type.description }}</text>

          <view class="room-type__foot">
            <text class="room-type__available">
              {{ type.available_count ? `今日可售 ${type.available_count} 间` : '该日期暂无可售房间' }}
            </text>
            <view class="room-type__detail-btn">
              查看详情
              <text class="room-type__detail-arrow">›</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view v-else class="card">
      <EmptyState
        icon="🏨"
        :description="`${checkIn} 至 ${checkOut} 暂无可售房型，请调整日期后重试`"
      />
    </view>

    <view class="rooms__footer">价格含服务费 · Mock 演示数据</view>
  </view>
</template>

<style scoped>
.date-card {
  display: flex;
  align-items: center;
  padding: 26rpx 24rpx;
}

.date-card__item {
  flex: 1;
  min-width: 0;
}

.date-card__label {
  font-size: 21rpx;
  color: #8c8c8c;
}

.date-card__value {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-top: 8rpx;
}

.date-card__date {
  font-size: 32rpx;
  font-weight: 700;
  color: #1f1f1f;
}

.date-card__arrow {
  color: #1677ff;
  font-size: 22rpx;
}

.date-card__divider {
  width: 2rpx;
  height: 56rpx;
  margin: 0 24rpx;
  background: #eef1f6;
}

.date-card__nights {
  flex-shrink: 0;
  margin-left: 16rpx;
  padding: 8rpx 18rpx;
  border-radius: 999rpx;
  background: #f0f6ff;
  color: #1677ff;
  font-size: 22rpx;
  font-weight: 600;
}

.room-type {
  overflow: hidden;
}

.room-type + .room-type {
  margin-top: 24rpx;
}

.room-type__cover {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  height: 240rpx;
  padding: 28rpx;
  color: #ffffff;
  overflow: hidden;
}

.room-type__cover-shine {
  position: absolute;
  top: -100rpx;
  right: -60rpx;
  width: 300rpx;
  height: 300rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.16);
}

.room-type__cover-name {
  font-size: 38rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
  text-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.16);
}

.room-type__cover-meta {
  margin-top: 8rpx;
  font-size: 23rpx;
  opacity: 0.86;
}

.room-type__price {
  position: absolute;
  top: 24rpx;
  right: 24rpx;
  display: flex;
  align-items: baseline;
  padding: 10rpx 22rpx;
  border-radius: 999rpx;
  background: rgba(0, 0, 0, 0.22);
  backdrop-filter: blur(8px);
}

.room-type__price-symbol {
  font-size: 22rpx;
}

.room-type__price-num {
  font-size: 40rpx;
  font-weight: 700;
}

.room-type__price-unit {
  font-size: 20rpx;
  opacity: 0.8;
}

.room-type__body {
  padding: 26rpx;
}

.room-type__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.room-type__stock {
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(82, 196, 26, 0.1);
  color: #52c41a;
  font-size: 21rpx;
  font-weight: 600;
}

.room-type__stock--empty {
  background: rgba(140, 140, 140, 0.12);
  color: #8c8c8c;
}

.room-type__specs {
  display: flex;
  align-items: center;
  gap: 10rpx;
  min-width: 0;
}

.room-type__spec {
  font-size: 23rpx;
  color: #8c8c8c;
}

.room-type__dot {
  color: #d9d9d9;
}

.room-type__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 18rpx;
}

.room-type__desc {
  display: block;
  margin-top: 18rpx;
  color: #8c8c8c;
  font-size: 23rpx;
  line-height: 1.6;
}

.room-type__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 22rpx;
  padding-top: 20rpx;
  border-top: 2rpx solid #f1f4f8;
}

.room-type__available {
  font-size: 22rpx;
  color: #1677ff;
}

.room-type__detail-btn {
  display: flex;
  align-items: center;
  gap: 4rpx;
  font-size: 24rpx;
  font-weight: 600;
  color: #1677ff;
}

.room-type__detail-arrow {
  font-size: 28rpx;
}

.rooms__footer {
  margin-top: 40rpx;
  text-align: center;
  color: #c1c7d0;
  font-size: 21rpx;
}
</style>
