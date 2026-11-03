<script setup>
/**
 * 告警中心：
 * - 顶部统计（紧急 / 待处理 / 已处理）；
 * - 待处理 / 全部 Tab；
 * - 处理按钮调用 alarmStore.handle，待处理列表即时消失；
 * - 支持按类型 / 等级筛选，卡片式展示设备告警上下文。
 */
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ALARM_LEVEL_LABEL,
  ALARM_STATUS,
  ALARM_TYPE_LABEL,
  PERMISSION,
  formatDateTime,
  formatRelativeTime
} from '@smart-home/utils'
import { useAlarmStore, useAuthStore } from '@smart-home/stores'
import StatCard from '@/components/StatCard.vue'
import PageHeader from '@/components/PageHeader.vue'

const auth = useAuthStore()
const alarmStore = useAlarmStore()

const activeTab = ref('pending')
const levelFilter = ref('')
const typeFilter = ref('')
const handlingId = ref('')

/** 是否可处理告警（财务无告警权限、其他人有） */
const canHandle = computed(() => auth.can(PERMISSION.B_ALARM_HANDLE))

/** 类型 / 等级选项 */
const typeOptions = Object.entries(ALARM_TYPE_LABEL).map(([value, label]) => ({ value, label }))
const levelOptions = Object.entries(ALARM_LEVEL_LABEL).map(([value, label]) => ({ value, label }))

/** 当前 Tab + 筛选后的列表 */
const visibleAlarms = computed(() => {
  let list = alarmStore.list
  if (activeTab.value === 'pending') list = list.filter((alarm) => alarm.status === ALARM_STATUS.PENDING)
  if (levelFilter.value) list = list.filter((alarm) => alarm.level === levelFilter.value)
  if (typeFilter.value) list = list.filter((alarm) => alarm.type === typeFilter.value)
  return list
})

/** 已处理数量 */
const handledCount = computed(
  () => alarmStore.list.filter((alarm) => alarm.status === ALARM_STATUS.HANDLED).length
)

/** 等级配色 */
const levelMeta = {
  high: { color: '#f5222d', soft: '#fff1f0', label: '紧急' },
  medium: { color: '#d48806', soft: '#fffbe6', label: '重要' },
  low: { color: '#1677ff', soft: '#e8f1ff', label: '一般' }
}

/** 类型图标 */
const typeIcon = {
  offline: 'Connection',
  sos: 'PhoneFilled',
  fault: 'Tools'
}

/**
 * 加载全部告警（Tab 与统计共用一次请求）。
 * @returns {Promise<void>}
 */
async function loadAlarms() {
  try {
    await alarmStore.fetchAlarms()
  } catch (error) {
    ElMessage.error(error.message || '告警加载失败')
  }
}

/**
 * 处理告警。
 * @param {Object} alarm
 * @returns {Promise<void>}
 */
async function handleAlarm(alarm) {
  if (!canHandle.value) {
    ElMessage.warning('当前角色无告警处理权限')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确认将「${alarm.type_label} · ${alarm.room_no} 房」标记为已处理？处理人将记录为当前登录员工。`,
      '处理告警',
      { confirmButtonText: '确认处理', cancelButtonText: '取消', type: 'warning' }
    )
  } catch (error) {
    return
  }

  handlingId.value = alarm.id
  try {
    await alarmStore.handle(alarm.id)
    ElMessage.success(`告警已处理（处理人：${auth.displayName}）`)
  } catch (error) {
    ElMessage.error(error.message || '告警处理失败')
  } finally {
    handlingId.value = ''
  }
}

/**
 * 重置筛选。
 */
function resetFilters() {
  levelFilter.value = ''
  typeFilter.value = ''
}

onMounted(loadAlarms)
</script>

<template>
  <div class="page">
    <PageHeader
      title="告警中心"
      icon="Warning"
      desc="设备离线、SOS 紧急呼叫、设备故障统一收口，值班员工处理后将记录处理人与时间"
    >
      <template #actions>
        <el-button :loading="alarmStore.loading" @click="loadAlarms">
          <el-icon><Refresh /></el-icon>
          <span>刷新告警</span>
        </el-button>
      </template>
    </PageHeader>

    <!-- 统计 -->
    <div class="alarm-stats">
      <StatCard
        label="紧急告警"
        :value="alarmStore.highLevelCount"
        unit="条"
        icon="WarningFilled"
        color="#f5222d"
        soft="#fff1f0"
        :danger="alarmStore.highLevelCount > 0"
        :foot="alarmStore.highLevelCount > 0 ? 'SOS / 离线等需立即响应' : '暂无紧急告警'"
      />
      <StatCard
        label="待处理告警"
        :value="alarmStore.pending"
        unit="条"
        icon="BellFilled"
        color="#fa8c16"
        soft="#fff5e6"
        :foot="`全部告警共 ${alarmStore.list.length} 条`"
      />
      <StatCard
        label="已处理告警"
        :value="handledCount"
        unit="条"
        icon="CircleCheckFilled"
        color="#52c41a"
        soft="#f0fbe8"
        :foot="`当前值班：${auth.roleLabel}`"
      />
    </div>

    <!-- 筛选 + Tab -->
    <section class="panel">
      <div class="filter-bar">
        <el-radio-group v-model="activeTab">
          <el-radio-button value="pending">待处理</el-radio-button>
          <el-radio-button value="all">全部告警</el-radio-button>
        </el-radio-group>

        <el-select v-model="levelFilter" placeholder="全部等级" clearable>
          <el-option v-for="item in levelOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>

        <el-select v-model="typeFilter" placeholder="全部类型" clearable>
          <el-option v-for="item in typeOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>

        <el-button @click="resetFilters">
          <el-icon><RefreshLeft /></el-icon>
          <span>重置</span>
        </el-button>

        <span class="filter-bar__spacer" />
        <span class="filter-bar__summary">
          当前展示<strong>{{ visibleAlarms.length }}</strong>条
        </span>
      </div>
    </section>

    <!-- 告警卡片 -->
    <div v-loading="alarmStore.loading" class="alarm-grid">
      <article
        v-for="alarm in visibleAlarms"
        :key="alarm.id"
        class="alarm-card"
        :style="{
          '--level-color': (levelMeta[alarm.level] || levelMeta.low).color,
          '--level-soft': (levelMeta[alarm.level] || levelMeta.low).soft
        }"
      >
        <div class="alarm-card__head">
          <span class="alarm-card__icon">
            <el-icon :size="20"><component :is="typeIcon[alarm.type] || 'Warning'" /></el-icon>
          </span>
          <div class="alarm-card__title">
            <strong>{{ alarm.type_label }}</strong>
            <span class="text-small text-muted">{{ alarm.device_name }}</span>
          </div>
          <el-tag size="small" effect="dark" :style="{ background: (levelMeta[alarm.level] || levelMeta.low).color, borderColor: (levelMeta[alarm.level] || levelMeta.low).color }">
            {{ ALARM_LEVEL_LABEL[alarm.level] || '一般' }}
          </el-tag>
        </div>

        <p class="alarm-card__content">{{ alarm.content }}</p>

        <div class="alarm-card__meta">
          <span>
            <el-icon :size="12"><Clock /></el-icon>
            {{ formatRelativeTime(alarm.created_at) }}
            <span class="text-muted">（{{ formatDateTime(alarm.created_at) }}）</span>
          </span>
          <span class="mono text-small">{{ alarm.device_id }}</span>
        </div>

        <div class="alarm-card__foot">
          <template v-if="alarm.status === ALARM_STATUS.PENDING">
            <el-tag type="warning" effect="plain" size="small">待处理</el-tag>
            <el-button
              v-if="canHandle"
              type="primary"
              size="small"
              :loading="handlingId === alarm.id"
              @click="handleAlarm(alarm)"
            >
              <el-icon><CircleCheck /></el-icon>
              <span>处理告警</span>
            </el-button>
            <el-tooltip v-else content="当前角色仅可查看告警，处理需前台 / 运维 / 店长权限" placement="top">
              <el-button size="small" disabled>无处理权限</el-button>
            </el-tooltip>
          </template>
          <template v-else>
            <el-tag type="success" effect="plain" size="small">已处理</el-tag>
            <span class="text-small text-muted">
              处理人：{{ alarm.handler || '—' }} · {{ formatDateTime(alarm.handled_at) }}
            </span>
          </template>
        </div>
      </article>

      <div v-if="!alarmStore.loading && !visibleAlarms.length" class="panel alarm-empty">
        <el-icon :size="36" style="color: #52c41a"><CircleCheckFilled /></el-icon>
        <h3>{{ activeTab === 'pending' ? '当前没有待处理告警' : '暂无告警记录' }}</h3>
        <p>门店设备运行良好，发生离线 / SOS / 故障时会自动出现在这里。</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.alarm-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.alarm-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 16px;
  min-height: 180px;
}

.alarm-card {
  position: relative;
  background: var(--card-bg);
  border-radius: var(--radius-card);
  border: 1px solid rgba(229, 234, 243, 0.9);
  border-left: 4px solid var(--level-color);
  box-shadow: var(--shadow-card);
  padding: 16px 18px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.alarm-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-card-hover);
}

.alarm-card__head {
  display: flex;
  align-items: center;
  gap: 11px;
}

.alarm-card__icon {
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  border-radius: 11px;
  background: var(--level-soft);
  color: var(--level-color);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 19px;
}

.alarm-card__title {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.alarm-card__title strong {
  font-size: 14px;
  color: var(--text-main);
}

.alarm-card__title span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.alarm-card__content {
  margin: 0;
  padding: 10px 12px;
  border-radius: 9px;
  background: #fafcff;
  border: 1px solid var(--border-light);
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--text-regular);
}

.alarm-card__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 11.5px;
  color: var(--text-secondary);
  flex-wrap: wrap;
}

.alarm-card__meta span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.alarm-card__foot {
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px dashed var(--border-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.alarm-empty {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 20px;
  text-align: center;
}

.alarm-empty h3 {
  margin: 12px 0 0;
  font-size: 16px;
  color: var(--text-main);
}

.alarm-empty p {
  margin: 8px 0 0;
  font-size: 12.5px;
  color: var(--text-secondary);
}

@media (max-width: 1200px) {
  .alarm-stats {
    grid-template-columns: 1fr;
  }

  .alarm-grid {
    grid-template-columns: 1fr;
  }
}
</style>
