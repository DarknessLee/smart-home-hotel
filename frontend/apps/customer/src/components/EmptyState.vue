<script setup>
/**
 * 通用空状态。
 */
defineProps({
  /** emoji 图标 */
  icon: {
    type: String,
    default: '🗂️'
  },
  /** 描述文案 */
  description: {
    type: String,
    default: '暂无数据'
  },
  /** 操作按钮文案（为空时不渲染按钮） */
  actionText: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['action'])
</script>

<template>
  <view class="empty">
    <text class="empty__icon">{{ icon }}</text>
    <text class="empty__text">{{ description }}</text>
    <button v-if="actionText" class="ghost-btn empty__action" @click="emit('action')">{{ actionText }}</button>
  </view>
</template>

<style scoped>
.empty__action {
  margin-top: 28rpx;
}
</style>
