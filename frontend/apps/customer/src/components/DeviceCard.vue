<script setup>
/**
 * 单台设备控制卡片（C 端设备面板核心交互单元）。
 *
 * 设计要点：
 * - 控件渲染配置来自 shared-utils 的 `DEVICE_PROPERTY_SCHEMA`（单一数据源），
 *   页面不重复维护属性范围 / 选项；
 * - 组件不直接调用 Pinia：只通过 `update` 事件把「属性名 + 目标值」交给页面，
 *   由页面统一走 `useDeviceStore().updateProperty`（乐观更新 + 失败回滚）；
 * - 离线设备整卡置灰、控件禁用并给出提示。
 */
import { computed } from 'vue'
import {
  DEVICE_ONLINE_STATUS,
  DEVICE_ONLINE_LABEL,
  DEVICE_PROPERTY_SCHEMA,
  DEVICE_TYPE,
  DEVICE_TYPE_ICON,
  DEVICE_TYPE_LABEL
} from '@smart-home/utils'
import { toast } from '@/utils/ui'

const props = defineProps({
  /** 设备对象（shared-api enrichDevice 结构） */
  device: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['update'])

/** 当前属性值 */
const state = computed(() => props.device.properties || {})

/** 是否离线 */
const offline = computed(() => props.device.online_status !== DEVICE_ONLINE_STATUS.ONLINE)

/** 在线文案（来自 shared-utils，避免页面硬编码） */
const onlineLabel = computed(() => DEVICE_ONLINE_LABEL[props.device.online_status] || '')

/** 设备类型文案 */
const typeLabel = computed(() => props.device.type_label || DEVICE_TYPE_LABEL[props.device.type] || props.device.type)

/** 设备图标（emoji，免静态资源） */
const icon = computed(() => DEVICE_TYPE_ICON[props.device.type] || '📦')

/** 当前设备类型的属性渲染配置 */
const schema = computed(() => DEVICE_PROPERTY_SCHEMA[props.device.type] || [])

/** 是否带电源属性 */
const hasPower = computed(() => schema.value.some((item) => item.key === 'power'))

/** 电源是否开启 */
const powerOn = computed(() => Boolean(state.value.power))

/** 窗帘预设开合度 */
const curtainPresets = [
  { label: '全关', value: 0 },
  { label: '半开', value: 50 },
  { label: '全开', value: 100 }
]

/**
 * 读取某个属性的渲染配置。
 * @param {string} key
 * @returns {{ key?: string, label?: string, min?: number, max?: number, step?: number, unit?: string, options?: Array<Object> }}
 */
function column(key) {
  return schema.value.find((item) => item.key === key) || {}
}

/**
 * 向上派发属性变更（离线设备直接拦截并提示）。
 * @param {string} key
 * @param {*} value
 * @returns {void}
 */
function emitUpdate(key, value) {
  if (offline.value) {
    toast('设备离线，暂不可控制')
    return
  }
  emit('update', { key, value })
}

/**
 * 电源开关。
 * @param {Object} event uni-app switch change 事件
 * @returns {void}
 */
function onPower(event) {
  emitUpdate('power', event.detail.value)
}

/**
 * 滑块变更（松手时下发，避免拖动过程高频请求）。
 * @param {string} key
 * @param {Object} event uni-app slider change 事件
 * @returns {void}
 */
function onSlider(key, event) {
  emitUpdate(key, event.detail.value)
}

/**
 * 步进调节（空调温度、频道等）。
 * @param {string} key
 * @param {number} delta
 * @returns {void}
 */
function adjust(key, delta) {
  const conf = column(key)
  const current = Number(state.value[key])
  const min = Number.isFinite(conf.min) ? conf.min : 0
  const max = Number.isFinite(conf.max) ? conf.max : 100
  const next = Math.min(max, Math.max(min, (Number.isFinite(current) ? current : min) + delta))
  if (next !== current) emitUpdate(key, next)
}

/**
 * 选项切换（空调模式 / 风速）。
 * @param {string} key
 * @param {*} value
 * @returns {void}
 */
function selectOption(key, value) {
  emitUpdate(key, value)
}
</script>

<template>
  <view class="device-card" :class="{ 'device-card--offline': offline }">
    <!-- 卡片头部：图标 / 名称 / 开关或在线态 -->
    <view class="device-card__head">
      <view class="device-card__identity">
        <view class="device-card__icon-wrap">
          <text class="device-card__icon">{{ icon }}</text>
        </view>
        <view class="device-card__meta">
          <text class="device-card__name">{{ typeLabel }}</text>
          <text class="device-card__sn">{{ device.name }} · {{ device.sn }}</text>
        </view>
      </view>

      <view class="device-card__action">
        <view v-if="offline" class="device-card__offline-tag">离线</view>
        <switch
          v-else-if="hasPower"
          :checked="powerOn"
          color="#4DA3FF"
          @change="onPower"
        />
        <text v-else class="device-card__online-tag">{{ onlineLabel }}</text>
      </view>
    </view>

    <!-- 离线提示 -->
    <view v-if="offline" class="device-card__offline-tip">设备心跳超时，已暂停控制，请联系前台处理</view>

    <!-- 灯光：总开关 + 亮度 + 色温 -->
    <view v-if="device.type === DEVICE_TYPE.LIGHT" class="device-body" :class="{ 'is-dim': !powerOn }">
      <view class="slider-row">
        <view class="slider-row__meta">
          <text class="slider-row__label">{{ column('brightness').label }}</text>
          <text class="slider-row__value">{{ state.brightness }}{{ column('brightness').unit }}</text>
        </view>
        <slider
          :value="state.brightness"
          :min="column('brightness').min"
          :max="column('brightness').max"
          :step="column('brightness').step"
          :disabled="offline"
          activeColor="#4DA3FF"
          backgroundColor="rgba(255,255,255,0.16)"
          block-color="#ffffff"
          :block-size="18"
          @change="onSlider('brightness', $event)"
        />
      </view>
      <view class="slider-row">
        <view class="slider-row__meta">
          <text class="slider-row__label">{{ column('color_temp').label }}</text>
          <text class="slider-row__value">{{ state.color_temp }}{{ column('color_temp').unit }}</text>
        </view>
        <slider
          :value="state.color_temp"
          :min="column('color_temp').min"
          :max="column('color_temp').max"
          :step="column('color_temp').step"
          :disabled="offline"
          activeColor="#FFC069"
          backgroundColor="rgba(255,255,255,0.16)"
          block-color="#ffffff"
          :block-size="18"
          @change="onSlider('color_temp', $event)"
        />
      </view>
    </view>

    <!-- 空调：温度加减 + 温度滑块 + 模式 + 风速 -->
    <view v-else-if="device.type === DEVICE_TYPE.AIR_CONDITIONER" class="device-body" :class="{ 'is-dim': !powerOn }">
      <view class="ac-temp">
        <view class="ac-temp__btn" @click="adjust('temperature', -1)">−</view>
        <view class="ac-temp__value">
          <text class="ac-temp__num">{{ state.temperature }}</text>
          <text class="ac-temp__unit">℃</text>
        </view>
        <view class="ac-temp__btn" @click="adjust('temperature', 1)">＋</view>
      </view>

      <view class="slider-row">
        <slider
          :value="state.temperature"
          :min="column('temperature').min"
          :max="column('temperature').max"
          :step="column('temperature').step"
          :disabled="offline"
          activeColor="#4DA3FF"
          backgroundColor="rgba(255,255,255,0.16)"
          block-color="#ffffff"
          :block-size="18"
          @change="onSlider('temperature', $event)"
        />
      </view>

      <view class="option-group">
        <text class="option-group__label">{{ column('mode').label }}</text>
        <view class="chips">
          <view
            v-for="option in column('mode').options"
            :key="option.value"
            class="chip"
            :class="{ 'chip--active': state.mode === option.value }"
            @click="selectOption('mode', option.value)"
          >
            {{ option.label }}
          </view>
        </view>
      </view>

      <view class="option-group">
        <text class="option-group__label">{{ column('fan_speed').label }}</text>
        <view class="chips">
          <view
            v-for="option in column('fan_speed').options"
            :key="option.value"
            class="chip"
            :class="{ 'chip--active': state.fan_speed === option.value }"
            @click="selectOption('fan_speed', option.value)"
          >
            {{ option.label }}
          </view>
        </view>
      </view>
    </view>

    <!-- 窗帘：开合度滑块 + 快捷预设 -->
    <view v-else-if="device.type === DEVICE_TYPE.CURTAIN" class="device-body">
      <view class="slider-row">
        <view class="slider-row__meta">
          <text class="slider-row__label">{{ column('open_percent').label }}</text>
          <text class="slider-row__value">{{ state.open_percent }}{{ column('open_percent').unit }}</text>
        </view>
        <slider
          :value="state.open_percent"
          :min="column('open_percent').min"
          :max="column('open_percent').max"
          :step="column('open_percent').step"
          :disabled="offline"
          activeColor="#4DA3FF"
          backgroundColor="rgba(255,255,255,0.16)"
          block-color="#ffffff"
          :block-size="18"
          @change="onSlider('open_percent', $event)"
        />
      </view>
      <view class="chips">
        <view
          v-for="preset in curtainPresets"
          :key="preset.value"
          class="chip"
          :class="{ 'chip--active': state.open_percent === preset.value }"
          @click="selectOption('open_percent', preset.value)"
        >
          {{ preset.label }}
        </view>
      </view>
    </view>

    <!-- 电视：音量 + 频道 -->
    <view v-else-if="device.type === DEVICE_TYPE.TV" class="device-body" :class="{ 'is-dim': !powerOn }">
      <view class="slider-row">
        <view class="slider-row__meta">
          <text class="slider-row__label">{{ column('volume').label }}</text>
          <text class="slider-row__value">{{ state.volume }}{{ column('volume').unit }}</text>
        </view>
        <slider
          :value="state.volume"
          :min="column('volume').min"
          :max="column('volume').max"
          :step="column('volume').step"
          :disabled="offline"
          activeColor="#4DA3FF"
          backgroundColor="rgba(255,255,255,0.16)"
          block-color="#ffffff"
          :block-size="18"
          @change="onSlider('volume', $event)"
        />
      </view>
      <view class="slider-row">
        <view class="slider-row__meta">
          <text class="slider-row__label">{{ column('channel').label }}</text>
          <text class="slider-row__value">{{ state.channel }}{{ column('channel').unit }}</text>
        </view>
        <slider
          :value="state.channel"
          :min="column('channel').min"
          :max="column('channel').max"
          :step="column('channel').step"
          :disabled="offline"
          activeColor="#B37FEB"
          backgroundColor="rgba(255,255,255,0.16)"
          block-color="#ffffff"
          :block-size="18"
          @change="onSlider('channel', $event)"
        />
      </view>
    </view>
  </view>
</template>

<style scoped>
.device-card {
  padding: 26rpx 26rpx 30rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.08);
  border-radius: 30rpx;
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(16px);
  transition: opacity 0.2s ease;
}

.device-card + .device-card {
  margin-top: 20rpx;
}

.device-card--offline {
  opacity: 0.55;
}

.device-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.device-card__identity {
  display: flex;
  align-items: center;
  gap: 18rpx;
  min-width: 0;
}

.device-card__icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 76rpx;
  height: 76rpx;
  border-radius: 22rpx;
  background: rgba(77, 163, 255, 0.16);
}

.device-card__icon {
  font-size: 38rpx;
}

.device-card__meta {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  min-width: 0;
}

.device-card__name {
  font-size: 30rpx;
  font-weight: 600;
  color: #ffffff;
}

.device-card__sn {
  font-size: 21rpx;
  color: rgba(255, 255, 255, 0.42);
}

.device-card__action {
  flex-shrink: 0;
  margin-left: 12rpx;
}

.device-card__online-tag {
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(82, 196, 26, 0.16);
  color: #95de64;
  font-size: 21rpx;
}

.device-card__offline-tag {
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(255, 77, 79, 0.18);
  color: #ff7875;
  font-size: 21rpx;
}

.device-card__offline-tip {
  margin-top: 18rpx;
  padding: 14rpx 18rpx;
  border-radius: 16rpx;
  background: rgba(255, 77, 79, 0.1);
  color: #ffa39e;
  font-size: 22rpx;
}

.device-body {
  margin-top: 10rpx;
  transition: opacity 0.2s ease;
}

.device-body.is-dim {
  opacity: 0.45;
}

.slider-row {
  margin-top: 20rpx;
}

.slider-row__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.slider-row__label {
  font-size: 23rpx;
  color: rgba(255, 255, 255, 0.55);
}

.slider-row__value {
  font-size: 23rpx;
  font-weight: 600;
  color: #7ec2ff;
}

.option-group {
  margin-top: 22rpx;
}

.option-group__label {
  font-size: 23rpx;
  color: rgba(255, 255, 255, 0.55);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
  margin-top: 12rpx;
}

.chip {
  padding: 10rpx 26rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.66);
  font-size: 23rpx;
  transition: all 0.2s ease;
}

.chip--active {
  background: linear-gradient(135deg, #1677ff 0%, #4da3ff 100%);
  color: #ffffff;
  font-weight: 600;
}

.ac-temp {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 48rpx;
  padding: 12rpx 0 4rpx;
}

.ac-temp__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 76rpx;
  height: 76rpx;
  border-radius: 50%;
  background: rgba(77, 163, 255, 0.16);
  color: #7ec2ff;
  font-size: 40rpx;
  font-weight: 500;
}

.ac-temp__value {
  display: flex;
  align-items: baseline;
  color: #ffffff;
}

.ac-temp__num {
  font-size: 76rpx;
  font-weight: 700;
  letter-spacing: -2rpx;
  line-height: 1;
}

.ac-temp__unit {
  margin-left: 4rpx;
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.6);
}
</style>
