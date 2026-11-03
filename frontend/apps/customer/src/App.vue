<script setup>
/**
 * 应用根组件：
 * - onLaunch 恢复本地登录态（shared-stores/auth 的 state 初始化也会读取缓存，这里做一次显式恢复）；
 * - 全局样式（卡片、按钮、排版工具类）统一在此维护，页面只写业务样式。
 */
import { onLaunch } from '@dcloudio/uni-app'
import { useAuthStore } from '@smart-home/stores'

onLaunch(() => {
  // 冷启动时恢复登录态（H5 刷新 / 小程序重启均适用）
  useAuthStore().restore()
})
</script>

<style>
/* ---------------------------------------------------------------------------
 * 全局基础样式
 * ------------------------------------------------------------------------- */
page {
  background-color: #f5f7fa;
  color: #1f1f1f;
  font-size: 28rpx;
  line-height: 1.5;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif;
}

view,
text,
input,
textarea,
button,
scroll-view,
swiper,
image {
  box-sizing: border-box;
}

.page {
  min-height: 100vh;
}

.page--padded {
  padding: 24rpx 24rpx calc(env(safe-area-inset-bottom) + 40rpx);
}

/* 卡片 */
.card {
  background: #ffffff;
  border-radius: 28rpx;
  box-shadow: 0 10rpx 40rpx rgba(22, 60, 120, 0.06);
}

/* 区块标题 */
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 36rpx 8rpx 20rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #1f1f1f;
}

.section-more {
  font-size: 24rpx;
  color: #8c8c8c;
}

/* 主按钮 / 次按钮 */
.primary-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 26rpx 0;
  border: none;
  border-radius: 999rpx;
  background: linear-gradient(135deg, #1677ff 0%, #4096ff 100%);
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 600;
  line-height: 1.2;
  box-shadow: 0 12rpx 28rpx rgba(22, 119, 255, 0.28);
}

.primary-btn::after {
  border: none;
}

.primary-btn[disabled] {
  opacity: 0.5;
  box-shadow: none;
}

.ghost-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 22rpx 36rpx;
  border: 2rpx solid #d6e4ff;
  border-radius: 999rpx;
  background: #f0f6ff;
  color: #1677ff;
  font-size: 28rpx;
  font-weight: 500;
  line-height: 1.2;
}

.ghost-btn::after {
  border: none;
}

/* 文本工具类 */
.muted {
  color: #8c8c8c;
}

.ellipsis {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.price {
  color: #fa541c;
  font-weight: 700;
}

.tag-pill {
  display: inline-flex;
  align-items: center;
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(22, 119, 255, 0.08);
  color: #1677ff;
  font-size: 22rpx;
  line-height: 1.6;
}

/* 空状态 */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 64rpx 32rpx;
}

.empty__icon {
  font-size: 72rpx;
  margin-bottom: 16rpx;
}

.empty__text {
  font-size: 26rpx;
  color: #8c8c8c;
  text-align: center;
}

/* 加载态 */
.loading-line {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40rpx 0;
  font-size: 26rpx;
  color: #8c8c8c;
}

/* 通用行布局 */
.row {
  display: flex;
  align-items: center;
}

.row--between {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.flex-1 {
  flex: 1;
  min-width: 0;
}

/* 底部固定操作栏（订单详情 / 下单页） */
.footer-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 20rpx 24rpx calc(env(safe-area-inset-bottom) + 20rpx);
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 -8rpx 30rpx rgba(22, 60, 120, 0.08);
  backdrop-filter: blur(10px);
}
</style>
