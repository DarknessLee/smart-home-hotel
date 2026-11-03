<script setup>
/**
 * tabBar 设备页：当前入住房间的设备控制面板 + 场景一键切换。
 *
 * 数据链路：
 * - 设备 / 场景：useDeviceStore.fetchDevices(room_id)、useSceneStore.fetchScenes()
 * - 属性下发：useDeviceStore.updateProperty（乐观更新 + 失败自动回滚）
 * - 场景执行：useSceneStore.execute(scene.id, room_id)，执行结果自动同步设备状态
 * - 未入住：展示「去实名 / 去预订」引导卡片
 */
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { useAppStore, useAuthStore, useDeviceStore, useRoomStore, useSceneStore } from '@smart-home/stores'
import { DEVICE_ONLINE_STATUS, toDate } from '@smart-home/utils'
import DeviceCard from '@/components/DeviceCard.vue'
import { ROUTES, ensureLoggedIn, navigate } from '@/utils/nav'
import { errorMessage, toast, toastSuccess } from '@/utils/ui'

const appStore = useAppStore()
const authStore = useAuthStore()
const deviceStore = useDeviceStore()
const roomStore = useRoomStore()
const sceneStore = useSceneStore()

/** 刷新中 */
const refreshing = ref(false)
/** 当前房间详情 */
const currentRoom = ref(null)

/** 当前入住房间 id（设备控制权依据） */
const roomId = computed(() => authStore.currentRoomId)
/** 是否有入住房间 */
const hasRoom = computed(() => Boolean(roomId.value))
/** 设备列表 */
const devices = computed(() => deviceStore.devices)
/** 在线设备数 */
const onlineCount = computed(() => deviceStore.onlineCount)
/** 运行中设备数 */
const powerOnCount = computed(() => deviceStore.powerOnCount)
/** 离线设备数 */
const offlineCount = computed(() => devices.value.length - onlineCount.value)
/** 场景列表 */
const scenes = computed(() => sceneStore.scenes)
/** 设备加载态 */
const loading = computed(() => deviceStore.loading)
/** 正在执行的场景 id */
const executingId = computed(() => sceneStore.executingId)

/** 房间号 */
const roomNo = computed(() => {
  if (currentRoom.value && currentRoom.value.room_no) return currentRoom.value.room_no
  return roomId.value ? roomId.value.replace(/^R/, '') : ''
})

/** 房型名 */
const roomTypeName = computed(() => (currentRoom.value && currentRoom.value.type_name) || '')

/** 同步时间（HH:mm:ss） */
const syncedAt = computed(() => {
  const date = toDate(deviceStore.lastSyncedAt)
  if (!date) return '--:--:--'
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((value) => String(value).padStart(2, '0'))
    .join(':')
})

/**
 * 加载房间信息 / 设备 / 场景。
 * @returns {Promise<void>}
 */
async function loadDashboard() {
  if (!roomId.value) {
    deviceStore.clear()
    currentRoom.value = null
    return
  }
  refreshing.value = true
  try {
    const tasks = [
      deviceStore.fetchDevices(roomId.value),
      roomStore
        .fetchRoom(roomId.value)
        .then((room) => {
          currentRoom.value = room
        })
        .catch(() => {
          currentRoom.value = null
        })
    ]
    if (!sceneStore.scenes.length) tasks.push(sceneStore.fetchScenes())
    await Promise.all(tasks)
  } catch (error) {
    toast(errorMessage(error, '设备加载失败'))
  } finally {
    refreshing.value = false
  }
}

onShow(() => {
  if (!ensureLoggedIn()) return
  loadDashboard()
})

onPullDownRefresh(async () => {
  if (ensureLoggedIn()) {
    if (sceneStore.scenes.length) await sceneStore.fetchScenes()
    await loadDashboard()
  }
  uni.stopPullDownRefresh()
})

/**
 * 设备属性变更（统一走 device store 的乐观更新 action）。
 * @param {Object} device
 * @param {{ key: string, value: * }} payload
 * @returns {Promise<void>}
 */
async function handleDeviceUpdate(device, payload) {
  if (device.online_status !== DEVICE_ONLINE_STATUS.ONLINE) {
    toast('设备离线，暂不可控制')
    return
  }
  try {
    await deviceStore.updateProperty(device.id, payload.key, payload.value)
  } catch (error) {
    toast(errorMessage(error, '指令下发失败，已恢复原状态'))
  }
}

/**
 * 执行场景（入住 / 睡眠 / 观影 / 离店）。
 * @param {Object} scene
 * @returns {Promise<void>}
 */
async function runScene(scene) {
  if (!roomId.value) {
    toast('请先办理入住')
    return
  }
  if (executingId.value) return
  try {
    await sceneStore.execute(scene.id, roomId.value)
    toastSuccess(`已切换${scene.name}`)
    // 场景执行后重新拉取设备，保证面板状态与 Mock 数据一致
    await deviceStore.fetchDevices(roomId.value)
  } catch (error) {
    toast(errorMessage(error, '场景执行失败'))
  }
}
</script>

<template>
  <view class="device-page">
    <!-- 沉浸式头部 -->
    <view class="device-hero">
      <view class="device-hero__nav">
        <text class="device-hero__nav-title">设备</text>
        <view class="device-hero__sync" @click="loadDashboard">
          <text class="device-hero__sync-icon" :class="{ 'device-hero__sync-icon--spin': refreshing }">⟳</text>
          <text class="device-hero__sync-text">{{ syncedAt }}</text>
        </view>
      </view>

      <template v-if="hasRoom">
        <view class="device-hero__room">
          <view class="device-hero__room-main">
            <view class="device-hero__room-line">
              <text class="device-hero__room-no">{{ roomNo }}</text>
              <text class="device-hero__room-unit">房</text>
              <text v-if="roomTypeName" class="device-hero__room-type">{{ roomTypeName }}</text>
            </view>
            <text class="device-hero__room-desc">全屋智能已就绪 · 点击卡片即可控制</text>
          </view>
          <view class="device-hero__stats">
            <view class="device-stat">
              <text class="device-stat__num">{{ onlineCount }}/{{ devices.length }}</text>
              <text class="device-stat__label">在线设备</text>
            </view>
            <view class="device-stat">
              <text class="device-stat__num">{{ powerOnCount }}</text>
              <text class="device-stat__label">运行中</text>
            </view>
          </view>
        </view>
      </template>

      <view v-else class="device-hero__offline">
        <text class="device-hero__offline-title">尚未入住</text>
        <text class="device-hero__offline-desc">办理入住后即可解锁全屋智能控制</text>
      </view>
    </view>

    <!-- 未入住引导 -->
    <view v-if="!hasRoom" class="device-guide">
      <view class="guide-card">
        <text class="guide-card__icon">🏨</text>
        <text class="guide-card__title">先办理入住，再控制设备</text>
        <text class="guide-card__desc">完成实名认证并入住后，可控制灯光、空调、窗帘、电视，并一键切换场景</text>
        <view class="guide-card__actions">
          <button class="primary-btn guide-card__btn" @click="navigate(ROUTES.CHECKIN)">去实名认证</button>
          <button class="ghost-btn guide-card__btn-ghost" @click="navigate(ROUTES.ROOMS)">去预订客房</button>
        </view>
      </view>

      <view class="guide-tips">
        <view class="guide-tip">
          <text class="guide-tip__icon">💡</text>
          <text class="guide-tip__text">入住后可控制灯光亮度与色温</text>
        </view>
        <view class="guide-tip">
          <text class="guide-tip__icon">🌙</text>
          <text class="guide-tip__text">睡眠场景自动熄灯、闭合窗帘</text>
        </view>
        <view class="guide-tip">
          <text class="guide-tip__icon">🎬</text>
          <text class="guide-tip__text">观影场景一键开启影音氛围</text>
        </view>
      </view>
    </view>

    <!-- 已入住：场景 + 设备面板 -->
    <template v-else>
      <view class="panel-section">
        <view class="panel-head">
          <text class="panel-head__title">智能场景</text>
          <text class="panel-head__hint">一键联动全屋设备</text>
        </view>
        <view class="scene-grid">
          <view
            v-for="scene in scenes"
            :key="scene.id"
            class="scene-btn"
            :class="{
              'scene-btn--active': sceneStore.lastExecutedId === scene.id,
              'scene-btn--loading': executingId === scene.id
            }"
            @click="runScene(scene)"
          >
            <text class="scene-btn__icon">{{ scene.icon }}</text>
            <text class="scene-btn__name">{{ scene.name }}</text>
            <text class="scene-btn__state">{{ executingId === scene.id ? '执行中...' : scene.description || '一键执行' }}</text>
          </view>
        </view>
      </view>

      <view class="panel-section">
        <view class="panel-head">
          <text class="panel-head__title">房间设备</text>
          <text class="panel-head__hint">
            {{ offlineCount ? `${offlineCount} 台离线` : '全部在线' }}
          </text>
        </view>

        <view v-if="loading && !devices.length" class="panel-loading">正在同步设备状态...</view>
        <view v-else-if="devices.length">
          <DeviceCard
            v-for="device in devices"
            :key="device.id"
            :device="device"
            @update="handleDeviceUpdate(device, $event)"
          />
        </view>
        <view v-else class="panel-empty">该房间暂未绑定智能设备</view>
      </view>

      <view class="device-page__footer">
        {{ appStore.mockMode ? '设备状态由 Mock 网关模拟' : '设备状态由智能网关实时同步' }} · 下拉可刷新
      </view>
    </template>
  </view>
</template>

<style scoped>
.device-page {
  min-height: 100vh;
  padding-bottom: 60rpx;
  background: radial-gradient(circle at 80% 0%, #14284d 0%, #0b1220 42%, #070d18 100%);
}

.device-hero {
  padding: calc(var(--status-bar-height, 0px) + 24rpx) 32rpx 40rpx;
}

.device-hero__nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 72rpx;
}

.device-hero__nav-title {
  color: #ffffff;
  font-size: 34rpx;
  font-weight: 600;
  letter-spacing: 2rpx;
}

.device-hero__sync {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 20rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.6);
  font-size: 21rpx;
}

.device-hero__sync-icon {
  font-size: 24rpx;
  color: #7ec2ff;
}

.device-hero__sync-icon--spin {
  animation: device-spin 0.9s linear infinite;
}

.device-hero__room {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-top: 40rpx;
}

.device-hero__room-main {
  min-width: 0;
}

.device-hero__room-line {
  display: flex;
  align-items: baseline;
  gap: 6rpx;
}

.device-hero__room-no {
  color: #ffffff;
  font-size: 76rpx;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -1rpx;
}

.device-hero__room-unit {
  color: rgba(255, 255, 255, 0.5);
  font-size: 26rpx;
}

.device-hero__room-type {
  margin-left: 12rpx;
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(77, 163, 255, 0.18);
  color: #7ec2ff;
  font-size: 21rpx;
}

.device-hero__room-desc {
  display: block;
  margin-top: 14rpx;
  color: rgba(255, 255, 255, 0.5);
  font-size: 22rpx;
}

.device-hero__stats {
  display: flex;
  gap: 16rpx;
  flex-shrink: 0;
}

.device-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;
  min-width: 110rpx;
  padding: 14rpx 12rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.08);
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.05);
}

.device-stat__num {
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 700;
}

.device-stat__label {
  color: rgba(255, 255, 255, 0.45);
  font-size: 19rpx;
}

.device-hero__offline {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  margin-top: 44rpx;
}

.device-hero__offline-title {
  color: #ffffff;
  font-size: 52rpx;
  font-weight: 700;
}

.device-hero__offline-desc {
  color: rgba(255, 255, 255, 0.5);
  font-size: 24rpx;
}

.device-guide {
  padding: 0 24rpx;
}

.guide-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48rpx 36rpx 40rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.08);
  border-radius: 32rpx;
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(18px);
}

.guide-card__icon {
  font-size: 88rpx;
}

.guide-card__title {
  margin-top: 24rpx;
  color: #ffffff;
  font-size: 34rpx;
  font-weight: 700;
}

.guide-card__desc {
  margin-top: 14rpx;
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
  font-size: 23rpx;
  line-height: 1.7;
}

.guide-card__actions {
  display: flex;
  gap: 20rpx;
  width: 100%;
  margin-top: 36rpx;
}

.guide-card__btn {
  flex: 1;
  padding: 22rpx 0;
  font-size: 27rpx;
}

.guide-card__btn-ghost {
  flex: 1;
  padding: 20rpx 0;
  font-size: 25rpx;
  border-color: rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.08);
  color: #9dc6ff;
}

.guide-tips {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 24rpx;
}

.guide-tip {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 22rpx 26rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.06);
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.04);
}

.guide-tip__icon {
  font-size: 32rpx;
}

.guide-tip__text {
  color: rgba(255, 255, 255, 0.6);
  font-size: 23rpx;
}

.panel-section {
  padding: 0 24rpx;
  margin-top: 8rpx;
}

.panel-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin: 26rpx 8rpx 18rpx;
}

.panel-head__title {
  color: #ffffff;
  font-size: 31rpx;
  font-weight: 600;
}

.panel-head__hint {
  color: rgba(255, 255, 255, 0.4);
  font-size: 21rpx;
}

.scene-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.scene-btn {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  width: calc((100% - 16rpx) / 2);
  padding: 24rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.08);
  border-radius: 26rpx;
  background: rgba(255, 255, 255, 0.06);
  transition: all 0.2s ease;
}

.scene-btn--active {
  border-color: rgba(77, 163, 255, 0.5);
  background: rgba(77, 163, 255, 0.16);
}

.scene-btn--loading {
  opacity: 0.6;
}

.scene-btn__icon {
  font-size: 40rpx;
}

.scene-btn__name {
  margin-top: 6rpx;
  color: #ffffff;
  font-size: 27rpx;
  font-weight: 600;
}

.scene-btn__state {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  color: rgba(255, 255, 255, 0.4);
  font-size: 19rpx;
  line-height: 1.4;
  min-height: 56rpx;
}

.panel-loading,
.panel-empty {
  padding: 60rpx 0;
  text-align: center;
  color: rgba(255, 255, 255, 0.4);
  font-size: 24rpx;
}

.device-page__footer {
  margin-top: 44rpx;
  text-align: center;
  color: rgba(255, 255, 255, 0.24);
  font-size: 20rpx;
  letter-spacing: 2rpx;
}

@keyframes device-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
