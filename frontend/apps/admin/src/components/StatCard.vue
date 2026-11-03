<script setup>
/**
 * KPI 指标卡（大字号数字 + 图标 + 底部说明）。
 */
defineProps({
  /** 指标名称 */
  label: { type: String, required: true },
  /** 指标主值（已格式化字符串） */
  value: { type: [String, Number], default: '-' },
  /** 数值后缀单位 */
  unit: { type: String, default: '' },
  /** Element Plus 图标名 */
  icon: { type: String, default: 'TrendCharts' },
  /** 主题色 */
  color: { type: String, default: '#1677ff' },
  /** 浅色底 */
  soft: { type: String, default: '#e8f1ff' },
  /** 底部说明文字 */
  foot: { type: String, default: '' },
  /** 是否危险态（告警等） */
  danger: { type: Boolean, default: false },
  /** 加载中 */
  loading: { type: Boolean, default: false }
})
</script>

<template>
  <div class="kpi-card" :class="{ 'is-danger': danger }" :style="{ '--kpi-color': color, '--kpi-soft': soft }">
    <div class="kpi-card__top">
      <span class="kpi-card__label">{{ label }}</span>
      <span class="kpi-card__icon">
        <el-icon :size="19"><component :is="icon" /></el-icon>
      </span>
    </div>
    <div class="kpi-card__value">
      <el-skeleton v-if="loading" animated :rows="0">
        <template #template>
          <el-skeleton-item variant="text" style="width: 108px; height: 30px" />
        </template>
      </el-skeleton>
      <template v-else>
        {{ value }}<small v-if="unit">{{ unit }}</small>
      </template>
    </div>
    <div class="kpi-card__foot">
      <slot name="foot">
        <span v-if="foot">{{ foot }}</span>
      </slot>
    </div>
  </div>
</template>

<style scoped>
.kpi-card__value :deep(.el-skeleton) {
  display: block;
}
</style>
