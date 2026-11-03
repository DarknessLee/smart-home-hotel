<script setup>
/**
 * 实名认证 + 入住激活 + 一键开门（C 端入住流程页）。
 *
 * - 实名认证：姓名 + 身份证号 + 模拟上传身份证，调用 authStore.realNameVerify（Mock 2 秒返回）；
 * - 入住激活：展示「已确认 / 待入住」订单，调用 orderStore.checkIn 激活房间设备控制权；
 * - 一键开门：本地开门成功动画（后续接入门锁 IoT 接口时替换为真实指令）。
 */
import { computed, onUnmounted, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { useAuthStore, useOrderStore } from '@smart-home/stores'
import {
  ORDER_STATUS,
  formatDateTime,
  isIdCard,
  isRealName,
  maskIdCard,
  maskName
} from '@smart-home/utils'
import EmptyState from '@/components/EmptyState.vue'
import { ROUTES, ensureLoggedIn, navigate } from '@/utils/nav'
import { confirmAction, errorMessage, hideLoading, showLoading, toast, toastSuccess } from '@/utils/ui'

const authStore = useAuthStore()
const orderStore = useOrderStore()

/** 实名表单：姓名 */
const realName = ref('')
/** 实名表单：身份证号 */
const idCard = ref('')
/** 是否已模拟选择身份证照片 */
const idImageSelected = ref(false)
/** 实名认证中 */
const verifying = ref(false)
/** 正在激活的订单 id */
const activatingId = ref('')
/** 开门动画是否可见 */
const doorVisible = ref(false)
/** 订单加载态 */
const loadingOrders = ref(false)

/** 当前用户 */
const user = computed(() => authStore.user || {})
/** 是否已实名 */
const isVerified = computed(() => authStore.isVerified)

/** 待入住订单（已确认 / 待入住） */
const pendingOrders = computed(() =>
  orderStore.list.filter(
    (order) => order.status === ORDER_STATUS.CONFIRMED || order.status === ORDER_STATUS.AWAITING_CHECKIN
  )
)

/** 已入住订单 */
const checkedInOrder = computed(
  () => orderStore.list.find((order) => order.status === ORDER_STATUS.CHECKED_IN) || null
)

/** 当前房间号 */
const currentRoomNo = computed(() => {
  if (checkedInOrder.value) return checkedInOrder.value.room_no
  const roomId = authStore.currentRoomId
  return roomId ? roomId.replace(/^R/, '') : ''
})

/** 当前房间名（房型快照） */
const currentRoomType = computed(() => (checkedInOrder.value ? checkedInOrder.value.type_name : ''))

/** @type {ReturnType<typeof setTimeout>|null} */
let doorTimer = null

/**
 * 加载我的订单。
 * @returns {Promise<void>}
 */
async function loadOrders() {
  loadingOrders.value = true
  try {
    // Mock 接口对 self 做严格字符串比较，这里传 '1'（已向 Lead 反馈对齐问题）
    await orderStore.fetchOrders({ self: '1', page: 1, page_size: 50 })
  } catch (error) {
    toast(errorMessage(error, '订单加载失败'))
  } finally {
    loadingOrders.value = false
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

onUnmounted(() => {
  if (doorTimer) clearTimeout(doorTimer)
  doorTimer = null
})

/**
 * 模拟选择身份证照片（Mock 阶段不调用真实相册）。
 * @returns {void}
 */
function chooseIdImage() {
  idImageSelected.value = true
  toastSuccess('已选择身份证照片')
}

/**
 * 提交实名认证。
 * @returns {Promise<void>}
 */
async function submitVerify() {
  if (verifying.value) return
  if (!isRealName(realName.value)) {
    toast('请输入 2~15 位中文姓名')
    return
  }
  if (!isIdCard(idCard.value)) {
    toast('请输入 18 位有效身份证号')
    return
  }
  if (!idImageSelected.value) {
    toast('请先上传身份证照片')
    return
  }

  verifying.value = true
  showLoading('认证中...')
  try {
    await authStore.realNameVerify({
      real_name: realName.value.trim(),
      id_card: idCard.value.trim().toUpperCase(),
      image: 'mock-id-card.jpg'
    })
    hideLoading()
    toastSuccess('实名认证成功')
    realName.value = ''
    idCard.value = ''
  } catch (error) {
    hideLoading()
    toast(errorMessage(error, '实名认证失败，请检查信息'))
  } finally {
    verifying.value = false
  }
}

/**
 * 办理入住（激活设备控制权）。
 * @param {Object} order
 * @returns {Promise<void>}
 */
async function activateStay(order) {
  if (activatingId.value) return
  if (!isVerified.value) {
    toast('请先完成实名认证')
    return
  }
  const confirmed = await confirmAction({
    title: '办理入住',
    content: `确认入住 ${order.room_no} 房（${order.type_name}）吗？入住后即可控制房间设备。`,
    confirmText: '确认入住'
  })
  if (!confirmed) return

  activatingId.value = order.id
  try {
    await orderStore.checkIn(order.id)
    await authStore.fetchProfile().catch(() => null)
    await loadOrders()
    toastSuccess('入住成功')
  } catch (error) {
    toast(errorMessage(error, '入住失败，请稍后重试'))
  } finally {
    activatingId.value = ''
  }
}

/**
 * 一键开门（本地动画）。
 * @returns {void}
 */
function openDoor() {
  if (!currentRoomNo.value) {
    toast('当前没有可控制的房间')
    return
  }
  if (doorVisible.value) return
  doorVisible.value = true
  if (doorTimer) clearTimeout(doorTimer)
  doorTimer = setTimeout(() => {
    doorVisible.value = false
    doorTimer = null
  }, 2200)
}
</script>

<template>
  <view class="page page--padded checkin">
    <!-- 实名认证 -->
    <view class="section-head">
      <text class="section-title">实名认证</text>
      <view class="status-badge" :class="{ 'status-badge--ok': isVerified }">
        {{ isVerified ? '已认证' : '未认证' }}
      </view>
    </view>

    <view class="card verify-card">
      <template v-if="isVerified">
        <view class="verify-card__done">
          <text class="verify-card__done-icon">✅</text>
          <view class="verify-card__done-content">
            <text class="verify-card__done-title">{{ maskName(user.real_name) }}</text>
            <text class="verify-card__done-desc">身份证号 {{ maskIdCard(user.id_card) }}</text>
          </view>
        </view>
        <view class="verify-card__hint">已完成实名认证，可自助办理入住与开门</view>
      </template>

      <template v-else>
        <text class="verify-card__desc">根据公安要求，入住前需完成实名认证（演示环境为 Mock 校验）</text>

        <view class="field-row">
          <text class="field-row__label">真实姓名</text>
          <input
            v-model="realName"
            class="field-row__input"
            maxlength="15"
            placeholder="请输入身份证上的姓名"
            placeholder-class="field-row__placeholder"
          />
        </view>

        <view class="field-row">
          <text class="field-row__label">身份证号</text>
          <input
            v-model="idCard"
            class="field-row__input"
            maxlength="18"
            placeholder="请输入 18 位身份证号"
            placeholder-class="field-row__placeholder"
          />
        </view>

        <view class="upload" :class="{ 'upload--done': idImageSelected }" @click="chooseIdImage">
          <text class="upload__icon">{{ idImageSelected ? '🖼️' : '📷' }}</text>
          <text class="upload__text">{{ idImageSelected ? '已选择身份证照片（模拟）' : '上传身份证' }}</text>
          <text class="upload__hint">点击模拟选择图片</text>
        </view>

        <button class="primary-btn verify-card__submit" :loading="verifying" :disabled="verifying" @click="submitVerify">
          {{ verifying ? '认证中...' : '提交实名认证' }}
        </button>
      </template>
    </view>

    <!-- 入住激活 -->
    <view class="section-head">
      <text class="section-title">入住激活</text>
      <text class="section-more">入住后解锁设备控制</text>
    </view>

    <view class="card stay-card">
      <view v-if="checkedInOrder" class="stay-card__current">
        <view class="stay-card__current-left">
          <text class="stay-card__current-no">{{ checkedInOrder.room_no }} 房</text>
          <text class="stay-card__current-type">{{ checkedInOrder.type_name }}</text>
          <text class="stay-card__current-time">{{ formatDateTime(checkedInOrder.check_in_time) }} 入住</text>
        </view>
        <view class="stay-card__current-badge">已激活</view>
      </view>

      <view v-if="pendingOrders.length" class="stay-card__list">
        <view v-for="order in pendingOrders" :key="order.id" class="stay-item">
          <view class="stay-item__info">
            <view class="stay-item__title">
              <text class="stay-item__room">{{ order.room_no }} 房</text>
              <text class="stay-item__type">{{ order.type_name }}</text>
            </view>
            <text class="stay-item__time">{{ formatDateTime(order.check_in_time) }} 至 {{ formatDateTime(order.check_out_time) }}</text>
            <text class="stay-item__status">{{ order.status_label }}</text>
          </view>
          <button
            class="ghost-btn stay-item__btn"
            :loading="activatingId === order.id"
            :disabled="Boolean(activatingId)"
            @click="activateStay(order)"
          >
            办理入住
          </button>
        </view>
      </view>

      <EmptyState
        v-else-if="!loadingOrders && !checkedInOrder"
        icon="🛎️"
        description="暂无待入住订单，先去预订一间客房吧"
        action-text="预订客房"
        @action="navigate(ROUTES.ROOMS)"
      />
    </view>

    <!-- 一键开门 -->
    <view class="section-head">
      <text class="section-title">一键开门</text>
      <text class="section-more">{{ currentRoomNo ? `${currentRoomNo} 房` : '未入住' }}</text>
    </view>

    <view class="card door-card">
      <view class="door-card__lock" :class="{ 'door-card__lock--disabled': !currentRoomNo }" @click="openDoor">
        <text class="door-card__lock-icon">🔐</text>
      </view>
      <text class="door-card__title">{{ currentRoomNo ? `${currentRoomNo} 房 · ${currentRoomType}` : '暂无可用房门' }}</text>
      <text class="door-card__desc">
        {{ currentRoomNo ? '点击上方门锁图标，模拟蓝牙解锁房门' : '完成入住激活后即可使用手机开门' }}
      </text>
      <button class="primary-btn door-card__btn" :disabled="!currentRoomNo" @click="openDoor">点击开门</button>
    </view>

    <!-- 开门成功遮罩 -->
    <view v-if="doorVisible" class="door-mask">
      <view class="door-mask__ripple door-mask__ripple--one" />
      <view class="door-mask__ripple door-mask__ripple--two" />
      <view class="door-mask__center">
        <text class="door-mask__icon">✅</text>
        <text class="door-mask__title">开门成功</text>
        <text class="door-mask__desc">{{ currentRoomNo }} 房 · 门锁已解锁</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.checkin {
  padding-top: 8rpx;
}

.status-badge {
  padding: 4rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(140, 140, 140, 0.12);
  color: #8c8c8c;
  font-size: 21rpx;
}

.status-badge--ok {
  background: rgba(82, 196, 26, 0.12);
  color: #52c41a;
}

.verify-card {
  padding: 28rpx;
}

.verify-card__desc {
  display: block;
  color: #8c8c8c;
  font-size: 23rpx;
  line-height: 1.6;
}

.verify-card__done {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.verify-card__done-icon {
  font-size: 52rpx;
}

.verify-card__done-content {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.verify-card__done-title {
  font-size: 32rpx;
  font-weight: 600;
}

.verify-card__done-desc {
  font-size: 23rpx;
  color: #8c8c8c;
}

.verify-card__hint {
  margin-top: 22rpx;
  padding: 16rpx 20rpx;
  border-radius: 16rpx;
  background: #f6ffed;
  color: #52c41a;
  font-size: 22rpx;
}

.field-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
  min-height: 96rpx;
  border-bottom: 2rpx solid #f4f6fa;
}

.field-row__label {
  flex-shrink: 0;
  width: 150rpx;
  font-size: 25rpx;
  color: #6b7280;
}

.field-row__input {
  flex: 1;
  min-width: 0;
  height: 96rpx;
  font-size: 26rpx;
}

.field-row__placeholder {
  color: #bfbfbf;
}

.upload {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 24rpx;
  padding: 24rpx;
  border: 2rpx dashed #cdddf8;
  border-radius: 22rpx;
  background: #f7fbff;
}

.upload--done {
  border-style: solid;
  border-color: #b7eb8f;
  background: #f6ffed;
}

.upload__icon {
  font-size: 42rpx;
}

.upload__text {
  flex: 1;
  min-width: 0;
  font-size: 25rpx;
  font-weight: 500;
  color: #1677ff;
}

.upload--done .upload__text {
  color: #52c41a;
}

.upload__hint {
  font-size: 20rpx;
  color: #a6adb8;
}

.verify-card__submit {
  margin-top: 28rpx;
}

.stay-card {
  padding: 8rpx 28rpx;
}

.stay-card__current {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 0;
  border-bottom: 2rpx solid #f4f6fa;
}

.stay-card__current-left {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.stay-card__current-no {
  font-size: 34rpx;
  font-weight: 700;
}

.stay-card__current-type {
  font-size: 23rpx;
  color: #8c8c8c;
}

.stay-card__current-time {
  font-size: 21rpx;
  color: #a6adb8;
}

.stay-card__current-badge {
  padding: 6rpx 20rpx;
  border-radius: 999rpx;
  background: rgba(82, 196, 26, 0.12);
  color: #52c41a;
  font-size: 22rpx;
  font-weight: 600;
}

.stay-card__list {
  padding: 10rpx 0;
}

.stay-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 22rpx 0;
  border-bottom: 2rpx solid #f6f8fb;
}

.stay-item:last-child {
  border-bottom: none;
}

.stay-item__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.stay-item__title {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
}

.stay-item__room {
  font-size: 30rpx;
  font-weight: 600;
}

.stay-item__type {
  font-size: 22rpx;
  color: #8c8c8c;
}

.stay-item__time {
  font-size: 21rpx;
  color: #a6adb8;
}

.stay-item__status {
  font-size: 21rpx;
  color: #1677ff;
}

.stay-item__btn {
  flex-shrink: 0;
  padding: 16rpx 28rpx;
  font-size: 24rpx;
}

.door-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40rpx 32rpx 36rpx;
}

.door-card__lock {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 168rpx;
  height: 168rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #1677ff 0%, #4096ff 100%);
  box-shadow: 0 20rpx 50rpx rgba(22, 119, 255, 0.32);
}

.door-card__lock--disabled {
  background: #e6eaf0;
  box-shadow: none;
}

.door-card__lock-icon {
  font-size: 72rpx;
}

.door-card__title {
  margin-top: 30rpx;
  font-size: 30rpx;
  font-weight: 600;
}

.door-card__desc {
  margin-top: 10rpx;
  text-align: center;
  font-size: 22rpx;
  color: #8c8c8c;
}

.door-card__btn {
  width: 100%;
  margin-top: 30rpx;
}

.door-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 99;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(8, 16, 34, 0.82);
  overflow: hidden;
}

.door-mask__ripple {
  position: absolute;
  width: 320rpx;
  height: 320rpx;
  border: 3rpx solid rgba(77, 163, 255, 0.55);
  border-radius: 50%;
  animation: door-ripple 1.8s ease-out infinite;
}

.door-mask__ripple--two {
  animation-delay: 0.6s;
}

.door-mask__center {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 56rpx 64rpx;
  border-radius: 40rpx;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(20px);
}

.door-mask__icon {
  font-size: 96rpx;
  animation: door-pop 0.5s ease-out both;
}

.door-mask__title {
  margin-top: 20rpx;
  color: #ffffff;
  font-size: 40rpx;
  font-weight: 700;
  letter-spacing: 4rpx;
}

.door-mask__desc {
  margin-top: 10rpx;
  color: rgba(255, 255, 255, 0.6);
  font-size: 24rpx;
}

@keyframes door-ripple {
  0% {
    transform: scale(0.6);
    opacity: 0.9;
  }
  100% {
    transform: scale(2.1);
    opacity: 0;
  }
}

@keyframes door-pop {
  0% {
    transform: scale(0.4);
  }
  70% {
    transform: scale(1.15);
  }
  100% {
    transform: scale(1);
  }
}
</style>
