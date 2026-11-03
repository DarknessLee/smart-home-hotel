<script setup>
/**
 * 页面标题区（标题 + 描述 + 右侧操作插槽）。
 */
defineProps({
  /** 标题 */
  title: { type: String, required: true },
  /** 副标题描述 */
  desc: { type: String, default: '' },
  /** Element Plus 图标名 */
  icon: { type: String, default: 'DataLine' }
})
</script>

<template>
  <div class="page-head">
    <div class="page-head__main">
      <h1 class="page-head__title">
        <span class="page-head__title-icon">
          <el-icon :size="18"><component :is="icon" /></el-icon>
        </span>
        {{ title }}
      </h1>
      <p v-if="desc" class="page-head__desc">{{ desc }}</p>
    </div>
    <div class="page-head__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.page-head__main {
  min-width: 0;
}
</style>
