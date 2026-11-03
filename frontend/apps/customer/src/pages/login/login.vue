<script setup>
/**
 * 登录页：手机号 + 4 位验证码（Mock 固定 1234）。
 *
 * - 一键填入演示账号 13800138000 / 1234；
 * - 登录成功后按角色 reLaunch 到 tabBar 首页；
 * - 已登录用户进入本页自动跳首页。
 */
import { computed, onUnmounted, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useAuthStore } from '@smart-home/stores'
import { DEMO_ACCOUNTS, isPhone, isSmsCode } from '@smart-home/utils'
import { ROUTES } from '@/utils/nav'
import { errorMessage, toast, toastSuccess } from '@/utils/ui'

const authStore = useAuthStore()

/** 手机号 */
const phone = ref('')
/** 验证码 */
const code = ref('')
/** 验证码倒计时（秒） */
const countdown = ref(0)
/** 是否正在提交登录 */
const submitting = ref(false)

/** 是否处于倒计时 */
const counting = computed(() => countdown.value > 0)

/** @type {ReturnType<typeof setInterval>|null} */
let timer = null

/**
 * 启动验证码倒计时。
 * @returns {void}
 */
function startCountdown() {
  countdown.value = 60
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0 && timer) {
      clearInterval(timer)
      timer = null
    }
  }, 1000)
}

onShow(() => {
  // 已登录：直接进入 tabBar 首页
  if (authStore.isLoggedIn) {
    uni.reLaunch({ url: ROUTES.INDEX })
  }
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
  timer = null
})

/**
 * 获取验证码（Mock 阶段不真实下发短信）。
 * @returns {void}
 */
function sendCode() {
  if (counting.value) return
  if (!isPhone(phone.value)) {
    toast('请输入正确的手机号')
    return
  }
  startCountdown()
  toast('验证码已发送，演示环境固定 1234')
}

/**
 * 一键填入演示账号。
 * @returns {void}
 */
function fillDemo() {
  phone.value = DEMO_ACCOUNTS.customer.phone
  code.value = DEMO_ACCOUNTS.customer.code
  toast('已填入演示账号，点击登录即可')
}

/**
 * 登录提交。
 * @returns {Promise<void>}
 */
async function submit() {
  if (submitting.value) return
  if (!isPhone(phone.value)) {
    toast('请输入正确的手机号')
    return
  }
  if (!isSmsCode(code.value)) {
    toast('请输入 4 位验证码')
    return
  }
  submitting.value = true
  try {
    await authStore.login({ phone: phone.value.trim(), code: code.value.trim() })
    toastSuccess('登录成功')
    setTimeout(() => {
      uni.reLaunch({ url: ROUTES.INDEX })
    }, 300)
  } catch (error) {
    toast(errorMessage(error, '登录失败，请重试'))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="login">
    <!-- 背景光斑 -->
    <view class="login__glow login__glow--one" />
    <view class="login__glow login__glow--two" />

    <view class="login__brand">
      <view class="login__logo">🏠</view>
      <text class="login__title">智慧住家</text>
      <text class="login__subtitle">未来城旗舰店 · 全屋智能客房</text>
    </view>

    <view class="login__card">
      <text class="login__card-title">手机号登录</text>
      <text class="login__card-desc">未注册手机号将自动创建顾客账号</text>

      <view class="field">
        <text class="field__icon">📱</text>
        <input
          v-model="phone"
          class="field__input"
          type="number"
          maxlength="11"
          placeholder="请输入手机号"
          placeholder-class="field__placeholder"
        />
      </view>

      <view class="field">
        <text class="field__icon">🔒</text>
        <input
          v-model="code"
          class="field__input"
          type="number"
          maxlength="4"
          placeholder="请输入 4 位验证码"
          placeholder-class="field__placeholder"
        />
        <text class="field__code" :class="{ 'field__code--disabled': counting }" @click="sendCode">
          {{ counting ? `${countdown}s 后重发` : '获取验证码' }}
        </text>
      </view>

      <view class="login__hint">
        演示环境验证码固定 <text class="login__hint-strong">1234</text>
      </view>

      <button class="primary-btn login__submit" :loading="submitting" :disabled="submitting" @click="submit">
        {{ submitting ? '登录中...' : '登 录' }}
      </button>

      <view class="login__demo" @click="fillDemo">
        <text class="login__demo-icon">✨</text>
        <text class="login__demo-text">一键填入演示账号（13800138000 / 1234）</text>
      </view>
    </view>

    <view class="login__footer">登录即代表同意《用户服务协议》与《隐私政策》</view>
  </view>
</template>

<style scoped>
.login {
  position: relative;
  min-height: 100vh;
  padding: calc(var(--status-bar-height, 0px) + 110rpx) 44rpx calc(env(safe-area-inset-bottom) + 48rpx);
  background: radial-gradient(circle at 18% 8%, #1e50d8 0%, #0b1e4d 46%, #050f26 100%);
  overflow: hidden;
}

.login__glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(30rpx);
  opacity: 0.55;
  pointer-events: none;
}

.login__glow--one {
  top: -120rpx;
  right: -100rpx;
  width: 420rpx;
  height: 420rpx;
  background: radial-gradient(circle, rgba(22, 119, 255, 0.9), transparent 70%);
}

.login__glow--two {
  bottom: 120rpx;
  left: -160rpx;
  width: 480rpx;
  height: 480rpx;
  background: radial-gradient(circle, rgba(114, 46, 209, 0.55), transparent 70%);
}

.login__brand {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 1;
}

.login__logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 132rpx;
  height: 132rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.22);
  border-radius: 40rpx;
  background: rgba(255, 255, 255, 0.12);
  box-shadow: 0 20rpx 60rpx rgba(0, 0, 0, 0.28);
  font-size: 64rpx;
  backdrop-filter: blur(10px);
}

.login__title {
  margin-top: 30rpx;
  color: #ffffff;
  font-size: 52rpx;
  font-weight: 700;
  letter-spacing: 4rpx;
}

.login__subtitle {
  margin-top: 12rpx;
  color: rgba(255, 255, 255, 0.62);
  font-size: 24rpx;
  letter-spacing: 1rpx;
}

.login__card {
  position: relative;
  z-index: 1;
  margin-top: 64rpx;
  padding: 44rpx 40rpx 36rpx;
  border-radius: 40rpx;
  background: rgba(255, 255, 255, 0.97);
  box-shadow: 0 30rpx 80rpx rgba(3, 16, 44, 0.4);
}

.login__card-title {
  display: block;
  color: #1f1f1f;
  font-size: 36rpx;
  font-weight: 700;
}

.login__card-desc {
  display: block;
  margin-top: 8rpx;
  color: #8c8c8c;
  font-size: 23rpx;
}

.field {
  display: flex;
  align-items: center;
  gap: 16rpx;
  height: 100rpx;
  margin-top: 26rpx;
  padding: 0 26rpx;
  border-radius: 24rpx;
  background: #f4f7fb;
}

.field__icon {
  font-size: 32rpx;
}

.field__input {
  flex: 1;
  min-width: 0;
  height: 100%;
  color: #1f1f1f;
  font-size: 30rpx;
}

.field__placeholder {
  color: #b8c0cc;
}

.field__code {
  flex-shrink: 0;
  padding-left: 18rpx;
  border-left: 2rpx solid #e6ebf2;
  color: #1677ff;
  font-size: 26rpx;
  font-weight: 600;
}

.field__code--disabled {
  color: #b8c0cc;
}

.login__hint {
  margin-top: 22rpx;
  padding: 14rpx 20rpx;
  border-radius: 16rpx;
  background: #f0f6ff;
  color: #5c7ba8;
  font-size: 23rpx;
}

.login__hint-strong {
  color: #1677ff;
  font-weight: 700;
  letter-spacing: 2rpx;
}

.login__submit {
  margin-top: 34rpx;
  padding: 28rpx 0;
}

.login__demo {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  margin-top: 26rpx;
  padding: 20rpx 0;
  border-radius: 20rpx;
  border: 2rpx dashed #cdddf8;
  color: #1677ff;
  font-size: 24rpx;
}

.login__demo-icon {
  font-size: 26rpx;
}

.login__footer {
  position: relative;
  z-index: 1;
  margin-top: 60rpx;
  text-align: center;
  color: rgba(255, 255, 255, 0.38);
  font-size: 21rpx;
}
</style>
