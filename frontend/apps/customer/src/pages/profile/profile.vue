<script setup>
/**
 * tabBar 我的页：用户信息 + 实名状态 + 功能入口 + 退出登录。
 */
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useAuthStore, useDeviceStore, useOrderStore, useRoomStore } from '@smart-home/stores'
import { formatDate, maskPhone } from '@smart-home/utils'
import { ROUTES, ensureLoggedIn, navigate } from '@/utils/nav'
import { confirmAction, errorMessage, toast } from '@/utils/ui'

const authStore = useAuthStore()
const orderStore = useOrderStore()
const roomStore = useRoomStore()
const deviceStore = useDeviceStore()

/** 当前房间详情 */
const currentRoom = ref(null)
/** 订单总数 */
const orderTotal = ref(0)

/** 当前用户 */
const user = computed(() => authStore.user || {})
/** 展示名 */
const displayName = computed(() => authStore.displayName)
/** 头像文字 */
const avatarText = computed(() => String(displayName.value || '客').slice(0, 1))
/** 是否已实名 */
const isVerified = computed(() => authStore.isVerified)
/** 当前房间号 */
const currentRoomNo = computed(() => {
  if (currentRoom.value && currentRoom.value.room_no) return currentRoom.value.room_no
  const roomId = authStore.currentRoomId
  return roomId ? roomId.replace(/^R/, '') : ''
})

/** 功能入口 */
const menuItems = computed(() => [
  {
    key: 'orders',
    icon: '📋',
    title: '我的订单',
    desc: orderTotal.value ? `${orderTotal.value} 笔订单` : '查看全部订单',
    path: ROUTES.ORDER_LIST
  },
  {
    key: 'checkin',
    icon: '🪪',
    title: '实名与入住',
    desc: isVerified.value ? '已实名认证' : '待完成实名认证',
    path: ROUTES.CHECKIN
  },
  {
    key: 'device',
    icon: '🎛️',
    title: '设备控制',
    desc: currentRoomNo.value ? `${currentRoomNo.value} 房控制面板` : '入住后可控制设备',
    path: ROUTES.DEVICE
  },
  {
    key: 'book',
    icon: '🛎️',
    title: '预订客房',
    desc: '5 种智能房型可选',
    path: ROUTES.ROOMS
  }
])

/**
 * 加载个人页数据。
 * @returns {Promise<void>}
 */
async function loadProfile() {
  try {
    await authStore.fetchProfile().catch(() => null)
    // Mock 接口对 self 做严格字符串比较，这里传 '1'（已向 Lead 反馈对齐问题）
    const data = await orderStore.fetchOrders({ self: '1', page: 1, page_size: 1 })
    orderTotal.value = data.total || 0
    if (authStore.currentRoomId) {
      currentRoom.value = await roomStore.fetchRoom(authStore.currentRoomId).catch(() => null)
    } else {
      currentRoom.value = null
    }
  } catch (error) {
    toast(errorMessage(error, '个人信息加载失败'))
  }
}

onShow(() => {
  if (!ensureLoggedIn()) return
  loadProfile()
})

/**
 * 打开功能入口。
 * @param {{ path: string }} item
 * @returns {void}
 */
function openMenu(item) {
  navigate(item.path)
}

/**
 * 关于我们。
 * @returns {void}
 */
function showAbout() {
  uni.showModal({
    title: '智慧住家',
    content: 'C 端顾客端 v0.1.0（Mock 演示版）\n未来城旗舰店 · 全屋智能客房',
    showCancel: false,
    confirmText: '知道了',
    confirmColor: '#1677FF'
  })
}

/**
 * 退出登录。
 * @returns {Promise<void>}
 */
async function logout() {
  const confirmed = await confirmAction({
    title: '退出登录',
    content: '确定要退出当前账号吗？',
    confirmText: '退出登录'
  })
  if (!confirmed) return
  try {
    await authStore.logout()
  } finally {
    deviceStore.clear()
    uni.reLaunch({ url: ROUTES.LOGIN })
  }
}
</script>

<template>
  <view class="page profile">
    <!-- 个人信息头图 -->
    <view class="profile-hero">
      <view class="profile-hero__nav">
        <text class="profile-hero__title">我的</text>
      </view>

      <view class="profile-hero__user">
        <view class="profile-hero__avatar">{{ avatarText }}</view>
        <view class="profile-hero__info">
          <view class="profile-hero__name-line">
            <text class="profile-hero__name">{{ displayName }}</text>
            <view class="profile-hero__verify" :class="{ 'profile-hero__verify--on': isVerified }">
              {{ isVerified ? '已实名' : '未实名' }}
            </view>
          </view>
          <text class="profile-hero__phone">{{ maskPhone(user.phone) }}</text>
        </view>
      </view>

      <view class="profile-hero__room" @click="navigate(ROUTES.DEVICE)">
        <view class="profile-hero__room-left">
          <text class="profile-hero__room-label">当前房间</text>
          <text class="profile-hero__room-value">{{ currentRoomNo ? `${currentRoomNo} 房` : '暂未入住' }}</text>
        </view>
        <view class="profile-hero__room-right">
          <text class="profile-hero__room-desc">{{ currentRoomNo ? '去控制设备' : '去预订客房' }}</text>
          <text class="profile-hero__room-arrow">›</text>
        </view>
      </view>
    </view>

    <view class="profile__body">
      <!-- 功能入口 -->
      <view class="menu-card card">
        <view v-for="item in menuItems" :key="item.key" class="menu-item" @click="openMenu(item)">
          <view class="menu-item__icon">{{ item.icon }}</view>
          <view class="menu-item__content">
            <text class="menu-item__title">{{ item.title }}</text>
            <text class="menu-item__desc">{{ item.desc }}</text>
          </view>
          <text class="menu-item__arrow">›</text>
        </view>
      </view>

      <!-- 账户信息 -->
      <view class="info-card card">
        <view class="info-line">
          <text class="info-line__label">账号 ID</text>
          <text class="info-line__value">{{ user.id || '--' }}</text>
        </view>
        <view class="info-line">
          <text class="info-line__label">手机号</text>
          <text class="info-line__value">{{ maskPhone(user.phone) }}</text>
        </view>
        <view class="info-line">
          <text class="info-line__label">注册时间</text>
          <text class="info-line__value">{{ user.created_at ? formatDate(user.created_at) : '--' }}</text>
        </view>
        <view class="info-line" @click="showAbout">
          <text class="info-line__label">关于我们</text>
          <text class="info-line__value info-line__value--link">v0.1.0 ›</text>
        </view>
      </view>

      <button class="logout-btn" @click="logout">退出登录</button>

      <view class="profile__footer">智慧住家 · 未来城旗舰店</view>
    </view>
  </view>
</template>

<style scoped>
.profile {
  padding-bottom: 60rpx;
}

.profile-hero {
  padding: calc(var(--status-bar-height, 0px) + 24rpx) 32rpx 96rpx;
  border-radius: 0 0 44rpx 44rpx;
  background: linear-gradient(140deg, #1677ff 0%, #2f7cff 46%, #5b8def 100%);
  color: #ffffff;
  overflow: hidden;
}

.profile-hero__nav {
  display: flex;
  align-items: center;
  height: 72rpx;
}

.profile-hero__title {
  font-size: 34rpx;
  font-weight: 600;
  letter-spacing: 2rpx;
}

.profile-hero__user {
  display: flex;
  align-items: center;
  gap: 24rpx;
  margin-top: 36rpx;
}

.profile-hero__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 124rpx;
  height: 124rpx;
  border: 3rpx solid rgba(255, 255, 255, 0.45);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  font-size: 48rpx;
  font-weight: 700;
}

.profile-hero__info {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.profile-hero__name-line {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.profile-hero__name {
  font-size: 40rpx;
  font-weight: 700;
}

.profile-hero__verify {
  padding: 4rpx 16rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.3);
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.14);
  font-size: 20rpx;
}

.profile-hero__verify--on {
  border-color: rgba(149, 222, 100, 0.5);
  background: rgba(82, 196, 26, 0.24);
}

.profile-hero__phone {
  font-size: 24rpx;
  opacity: 0.78;
}

.profile-hero__room {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 34rpx;
  padding: 24rpx 26rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.18);
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.12);
}

.profile-hero__room-left {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.profile-hero__room-label {
  font-size: 20rpx;
  opacity: 0.7;
}

.profile-hero__room-value {
  font-size: 30rpx;
  font-weight: 600;
}

.profile-hero__room-right {
  display: flex;
  align-items: center;
  gap: 6rpx;
}

.profile-hero__room-desc {
  font-size: 22rpx;
  opacity: 0.82;
}

.profile-hero__room-arrow {
  font-size: 32rpx;
  opacity: 0.82;
}

.profile__body {
  padding: 0 24rpx;
  margin-top: -56rpx;
}

.menu-card {
  overflow: hidden;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 26rpx 28rpx;
  border-bottom: 2rpx solid #f4f6fa;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-item__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72rpx;
  height: 72rpx;
  border-radius: 20rpx;
  background: #f0f6ff;
  font-size: 34rpx;
}

.menu-item__content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.menu-item__title {
  font-size: 28rpx;
  font-weight: 500;
}

.menu-item__desc {
  font-size: 21rpx;
  color: #a6adb8;
}

.menu-item__arrow {
  font-size: 32rpx;
  color: #c9cfd8;
}

.info-card {
  margin-top: 24rpx;
  padding: 8rpx 28rpx;
}

.info-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 88rpx;
  border-bottom: 2rpx solid #f4f6fa;
}

.info-line:last-child {
  border-bottom: none;
}

.info-line__label {
  font-size: 25rpx;
  color: #6b7280;
}

.info-line__value {
  font-size: 25rpx;
  color: #1f1f1f;
}

.info-line__value--link {
  color: #1677ff;
}

.logout-btn {
  margin-top: 40rpx;
  padding: 26rpx 0;
  border: 2rpx solid #ffccc7;
  border-radius: 999rpx;
  background: #fff1f0;
  color: #f5222d;
  font-size: 29rpx;
  font-weight: 600;
  line-height: 1.2;
}

.logout-btn::after {
  border: none;
}

.profile__footer {
  margin-top: 48rpx;
  text-align: center;
  color: #c1c7d0;
  font-size: 20rpx;
  letter-spacing: 2rpx;
}
</style>
