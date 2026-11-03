<script setup>
/**
 * tabBar 首页：欢迎区 + 当前入住 + 快捷入口 + 进行中订单。
 *
 * 数据来源：
 * - 用户 / 实名 / 当前房间：useAuthStore
 * - 订单：useOrderStore.fetchOrders({ self: '1' })
 * - 房间详情：useRoomStore.fetchRoom(room_id)
 */
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { useAuthStore, useOrderStore, useRoomStore } from '@smart-home/stores'
import { ORDER_STATUS, formatDate, isActiveOrder } from '@smart-home/utils'
import OrderCard from '@/components/OrderCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import { ROUTES, ensureLoggedIn, navigate } from '@/utils/nav'
import { errorMessage, toast } from '@/utils/ui'

const authStore = useAuthStore()
const orderStore = useOrderStore()
const roomStore = useRoomStore()

/** 页面加载态 */
const loading = ref(false)
/** 当前入住的房间详情 */
const currentRoom = ref(null)

/** 进行中订单（按状态机定义过滤） */
const activeOrders = computed(() =>
  orderStore.list.filter((order) => isActiveOrder(order.status)).slice(0, 3)
)

/** 已入住订单（当前入住卡片数据源） */
const stayOrder = computed(() => orderStore.list.find((order) => order.status === ORDER_STATUS.CHECKED_IN) || null)

/** 用户展示名 */
const displayName = computed(() => authStore.displayName)

/** 头像文字 */
const avatarText = computed(() => String(displayName.value || '客').slice(0, 1))

/** 是否已实名 */
const isVerified = computed(() => authStore.isVerified)

/** 问候语（按当前时段） */
const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 6) return '凌晨好'
  if (hour < 12) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
})

/** 当前入住房间号（优先房间详情，其次订单快照） */
const stayRoomNo = computed(() => {
  if (currentRoom.value && currentRoom.value.room_no) return currentRoom.value.room_no
  return stayOrder.value ? stayOrder.value.room_no : ''
})

/** 快捷入口 */
const quickEntries = [
  { key: 'book', icon: '🛎️', label: '预订客房', hint: '5 种智能房型', path: ROUTES.ROOMS },
  { key: 'orders', icon: '📋', label: '我的订单', hint: '订单状态全流程', path: ROUTES.ORDER_LIST },
  { key: 'device', icon: '🎛️', label: '控制设备', hint: '全屋一键联动', path: ROUTES.DEVICE },
  { key: 'checkin', icon: '🪪', label: '入住激活', hint: '实名 + 开门', path: ROUTES.CHECKIN }
]

/**
 * 加载首页数据。
 * @returns {Promise<void>}
 */
async function loadData() {
  loading.value = true
  try {
    // 注意：Mock 接口对 self 做严格字符串比较，这里传 '1'（已向 Lead 反馈对齐问题）
    await orderStore.fetchOrders({ self: '1', page: 1, page_size: 20 })
    if (authStore.currentRoomId) {
      currentRoom.value = await roomStore.fetchRoom(authStore.currentRoomId).catch(() => null)
    } else {
      currentRoom.value = null
    }
  } catch (error) {
    toast(errorMessage(error, '首页数据加载失败'))
  } finally {
    loading.value = false
  }
}

onShow(() => {
  if (!ensureLoggedIn()) return
  loadData()
})

onPullDownRefresh(async () => {
  if (ensureLoggedIn()) await loadData()
  uni.stopPullDownRefresh()
})

/**
 * 打开订单详情。
 * @param {Object} order
 * @returns {void}
 */
function openOrder(order) {
  navigate(`${ROUTES.ORDER_DETAIL}?id=${order.id}`)
}

/**
 * 打开快捷入口。
 * @param {{ path: string }} entry
 * @returns {void}
 */
function openEntry(entry) {
  navigate(entry.path)
}
</script>

<template>
  <view class="home">
    <!-- 渐变欢迎区 -->
    <view class="hero">
      <view class="hero__nav">
        <view class="hero__brand">
          <text class="hero__brand-icon">🏠</text>
          <text class="hero__brand-name">智慧住家</text>
        </view>
        <view class="hero__avatar" @click="navigate(ROUTES.PROFILE)">{{ avatarText }}</view>
      </view>

      <view class="hero__greeting">
        <text class="hero__hello">{{ greeting }}，{{ displayName }}</text>
        <view class="hero__badge" :class="{ 'hero__badge--on': isVerified }" @click="navigate(ROUTES.CHECKIN)">
          <text class="hero__badge-dot" />
          <text>{{ isVerified ? '已实名认证' : '未实名 · 去认证' }}</text>
        </view>
      </view>
      <text class="hero__desc">全屋智能已就绪，愿你在未来城的每一晚都舒心</text>
    </view>

    <view class="home__body">
      <!-- 当前入住 / 引导预订 -->
      <view v-if="stayOrder" class="stay card">
        <view class="stay__head">
          <view class="stay__title-wrap">
            <text class="stay__label">当前入住</text>
            <view class="stay__title">
              <text class="stay__room">{{ stayRoomNo }}</text>
              <text class="stay__unit">房</text>
              <text class="stay__type">{{ stayOrder.type_name }}</text>
            </view>
          </view>
          <view class="stay__status">{{ stayOrder.status_label }}</view>
        </view>

        <view class="stay__dates">
          <view class="stay__date-item">
            <text class="stay__date-label">入住</text>
            <text class="stay__date-value">{{ formatDate(stayOrder.check_in_time) }}</text>
          </view>
          <view class="stay__arrow">→</view>
          <view class="stay__date-item">
            <text class="stay__date-label">离店</text>
            <text class="stay__date-value">{{ formatDate(stayOrder.check_out_time) }}</text>
          </view>
          <view class="stay__nights">共 {{ stayOrder.nights }} 晚</view>
        </view>

        <view class="stay__actions">
          <button class="primary-btn stay__btn" @click="navigate(ROUTES.DEVICE)">进入设备面板</button>
          <button class="ghost-btn stay__btn-ghost" @click="openOrder(stayOrder)">查看订单</button>
        </view>
      </view>

      <view v-else class="stay card stay--empty">
        <text class="stay__empty-icon">🛏️</text>
        <view class="stay__empty-content">
          <text class="stay__empty-title">当前暂无入住</text>
          <text class="stay__empty-desc">预订一间智能客房，体验全屋设备一键控制</text>
        </view>
        <button class="ghost-btn stay__empty-btn" @click="navigate(ROUTES.ROOMS)">去预订</button>
      </view>

      <!-- 快捷入口 -->
      <view class="entry-grid">
        <view v-for="entry in quickEntries" :key="entry.key" class="entry" @click="openEntry(entry)">
          <view class="entry__icon">{{ entry.icon }}</view>
          <text class="entry__label">{{ entry.label }}</text>
          <text class="entry__hint">{{ entry.hint }}</text>
        </view>
      </view>

      <!-- 智能场景横幅 -->
      <view class="scene-banner" @click="navigate(ROUTES.DEVICE)">
        <view class="scene-banner__content">
          <text class="scene-banner__title">全屋智能场景</text>
          <text class="scene-banner__desc">入住 / 睡眠 / 观影 / 离店，一键切换灯光、空调与窗帘</text>
          <view class="scene-banner__cta">立即体验 →</view>
        </view>
        <text class="scene-banner__emoji">✨</text>
      </view>

      <!-- 进行中订单 -->
      <view class="section-head">
        <text class="section-title">进行中订单</text>
        <text class="section-more" @click="navigate(ROUTES.ORDER_LIST)">全部订单 ›</text>
      </view>

      <view v-if="activeOrders.length">
        <OrderCard v-for="order in activeOrders" :key="order.id" :order="order" @click="openOrder" />
      </view>
      <view v-else class="card">
        <EmptyState
          icon="🗂️"
          description="暂无进行中的订单，去预订一间智能客房吧"
          action-text="预订客房"
          @action="navigate(ROUTES.ROOMS)"
        />
      </view>

      <view class="home__footer">智慧住家 · 未来城旗舰店</view>
    </view>
  </view>
</template>

<style scoped>
.home {
  min-height: 100vh;
  padding-bottom: 40rpx;
}

.hero {
  position: relative;
  padding: calc(var(--status-bar-height, 0px) + 24rpx) 32rpx 56rpx;
  border-radius: 0 0 44rpx 44rpx;
  background: linear-gradient(140deg, #1677ff 0%, #2f7cff 46%, #5b8def 100%);
  color: #ffffff;
  overflow: hidden;
}

.hero::before {
  content: '';
  position: absolute;
  top: -140rpx;
  right: -120rpx;
  width: 420rpx;
  height: 420rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
}

.hero::after {
  content: '';
  position: absolute;
  bottom: -180rpx;
  left: -80rpx;
  width: 380rpx;
  height: 380rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
}

.hero__nav {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 72rpx;
}

.hero__brand {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.hero__brand-icon {
  font-size: 32rpx;
}

.hero__brand-name {
  font-size: 30rpx;
  font-weight: 600;
  letter-spacing: 2rpx;
}

.hero__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 68rpx;
  height: 68rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.4);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
  font-size: 28rpx;
  font-weight: 600;
}

.hero__greeting {
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16rpx;
  margin-top: 44rpx;
}

.hero__hello {
  font-size: 44rpx;
  font-weight: 700;
  letter-spacing: 1rpx;
}

.hero__badge {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 6rpx 18rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.32);
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.14);
  font-size: 21rpx;
}

.hero__badge--on {
  background: rgba(82, 196, 26, 0.24);
  border-color: rgba(149, 222, 100, 0.5);
}

.hero__badge-dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: #b7eb8f;
}

.hero__desc {
  position: relative;
  z-index: 1;
  display: block;
  margin-top: 18rpx;
  color: rgba(255, 255, 255, 0.78);
  font-size: 24rpx;
}

.home__body {
  padding: 0 24rpx;
}

.stay {
  position: relative;
  margin-top: -36rpx;
  padding: 30rpx;
}

.stay__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.stay__label {
  font-size: 23rpx;
  color: #8c8c8c;
}

.stay__title {
  display: flex;
  align-items: baseline;
  gap: 4rpx;
  margin-top: 6rpx;
}

.stay__room {
  font-size: 56rpx;
  font-weight: 700;
  color: #1f1f1f;
  line-height: 1.1;
}

.stay__unit {
  font-size: 24rpx;
  color: #8c8c8c;
}

.stay__type {
  margin-left: 10rpx;
  font-size: 24rpx;
  color: #1677ff;
}

.stay__status {
  padding: 6rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(82, 196, 26, 0.1);
  color: #52c41a;
  font-size: 22rpx;
  font-weight: 600;
}

.stay__dates {
  display: flex;
  align-items: center;
  gap: 18rpx;
  margin-top: 24rpx;
  padding: 20rpx 22rpx;
  border-radius: 20rpx;
  background: #f7f9fc;
}

.stay__date-item {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.stay__date-label {
  font-size: 21rpx;
  color: #8c8c8c;
}

.stay__date-value {
  font-size: 27rpx;
  font-weight: 600;
  color: #1f1f1f;
}

.stay__arrow {
  color: #bfbfbf;
  font-size: 24rpx;
}

.stay__nights {
  margin-left: auto;
  font-size: 22rpx;
  color: #8c8c8c;
}

.stay__actions {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-top: 26rpx;
}

.stay__btn {
  flex: 1;
  padding: 22rpx 0;
  font-size: 28rpx;
}

.stay__btn-ghost {
  padding: 20rpx 40rpx;
  font-size: 26rpx;
}

.stay--empty {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.stay__empty-icon {
  font-size: 56rpx;
}

.stay__empty-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.stay__empty-title {
  font-size: 30rpx;
  font-weight: 600;
}

.stay__empty-desc {
  font-size: 22rpx;
  color: #8c8c8c;
}

.stay__empty-btn {
  flex-shrink: 0;
  padding: 16rpx 30rpx;
  font-size: 24rpx;
}

.entry-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 18rpx;
  margin-top: 24rpx;
}

.entry {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  width: calc((100% - 36rpx) / 2);
  padding: 26rpx;
  border-radius: 26rpx;
  background: #ffffff;
  box-shadow: 0 10rpx 30rpx rgba(22, 60, 120, 0.05);
}

.entry__icon {
  font-size: 40rpx;
}

.entry__label {
  margin-top: 6rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: #1f1f1f;
}

.entry__hint {
  font-size: 21rpx;
  color: #a6adb8;
}

.scene-banner {
  display: flex;
  align-items: center;
  margin-top: 24rpx;
  padding: 32rpx;
  border-radius: 30rpx;
  background: linear-gradient(135deg, #1f1f3a 0%, #2d2a5e 52%, #43308c 100%);
  color: #ffffff;
  box-shadow: 0 16rpx 40rpx rgba(31, 31, 58, 0.24);
}

.scene-banner__content {
  flex: 1;
  min-width: 0;
}

.scene-banner__title {
  font-size: 32rpx;
  font-weight: 700;
}

.scene-banner__desc {
  display: block;
  margin-top: 10rpx;
  color: rgba(255, 255, 255, 0.68);
  font-size: 22rpx;
  line-height: 1.5;
}

.scene-banner__cta {
  display: inline-flex;
  margin-top: 20rpx;
  padding: 10rpx 26rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.16);
  font-size: 22rpx;
}

.scene-banner__emoji {
  margin-left: 16rpx;
  font-size: 76rpx;
  opacity: 0.9;
}

.home__footer {
  margin-top: 48rpx;
  text-align: center;
  color: #c1c7d0;
  font-size: 21rpx;
  letter-spacing: 2rpx;
}
</style>
