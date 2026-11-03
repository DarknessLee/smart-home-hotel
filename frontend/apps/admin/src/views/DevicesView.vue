<script setup>
/**
 * 设备运维：
 * - 类型 / 在线状态 / 关键字筛选 + 分页表格（设备 id、sn、房号、类型、在线状态、名称、心跳）；
 * - 「远程控制」抽屉：按 DEVICE_PROPERTY_SCHEMA 渲染开关 / 滑块 / 下拉，调用 deviceApi.updateProperties；
 * - 离线设备禁用控制并提示；「自检」调用 deviceApi.checkDevice。
 *
 * 说明：deviceStore 只覆盖单房间设备，因此列表直接使用 deviceApi 分页查询。
 */
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  DEVICE_ONLINE_LABEL,
  DEVICE_ONLINE_STATUS,
  DEVICE_PROPERTY_SCHEMA,
  DEVICE_TYPE_ICON,
  DEVICE_TYPE_LABEL,
  PERMISSION,
  formatDateTime
} from '@smart-home/utils'
import { deviceApi } from '@smart-home/api'
import { useAuthStore } from '@smart-home/stores'
import PageHeader from '@/components/PageHeader.vue'

const auth = useAuthStore()

const filters = ref({
  type: '',
  online_status: '',
  keyword: ''
})

const loading = ref(false)
const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)

const drawerVisible = ref(false)
const activeDevice = ref(null)
const draft = ref({})
const sendingKey = ref('')
const checking = ref(false)
const checkResult = ref('')

/** 是否可下发指令 */
const canOperate = computed(() => auth.can(PERMISSION.B_DEVICE_OPERATE))
/** 当前设备是否离线 */
const isOffline = computed(() => activeDevice.value && activeDevice.value.online_status === DEVICE_ONLINE_STATUS.OFFLINE)
/** 当前设备属性渲染配置 */
const schema = computed(() => (activeDevice.value ? DEVICE_PROPERTY_SCHEMA[activeDevice.value.type] || [] : []))

/** 类型筛选项 */
const typeOptions = Object.keys(DEVICE_TYPE_LABEL).map((type) => ({
  value: type,
  label: DEVICE_TYPE_LABEL[type]
}))

/**
 * 加载设备分页列表。
 * @returns {Promise<void>}
 */
async function loadDevices() {
  loading.value = true
  try {
    const data = await deviceApi.getDevices({
      type: filters.value.type || undefined,
      online_status: filters.value.online_status || undefined,
      keyword: filters.value.keyword.trim() || undefined,
      page: page.value,
      page_size: pageSize.value
    })
    if (Array.isArray(data)) {
      list.value = data
      total.value = data.length
    } else {
      list.value = data.list || []
      total.value = data.total || 0
    }
  } catch (error) {
    ElMessage.error(error.message || '设备列表加载失败')
  } finally {
    loading.value = false
  }
}

/**
 * 查询（回到第一页）。
 */
function handleSearch() {
  page.value = 1
  loadDevices()
}

/**
 * 重置筛选。
 */
function resetFilters() {
  filters.value = { type: '', online_status: '', keyword: '' }
  page.value = 1
  loadDevices()
}

/**
 * 分页大小变化。
 * @param {number} size
 */
function handleSizeChange(size) {
  pageSize.value = size
  page.value = 1
  loadDevices()
}

/**
 * 打开远程控制抽屉。
 * @param {Object} row
 * @returns {Promise<void>}
 */
async function openControl(row) {
  activeDevice.value = row
  draft.value = { ...(row.properties || {}) }
  checkResult.value = ''
  drawerVisible.value = true
  try {
    const device = await deviceApi.getDevice(row.id)
    activeDevice.value = device
    draft.value = { ...(device.properties || {}) }
  } catch (error) {
    console.warn('[devices] 设备详情刷新失败:', error.message)
  }
}

/**
 * 把设备最新数据合并回列表与抽屉。
 * @param {Object} device
 */
function mergeDevice(device) {
  if (!device) return
  const index = list.value.findIndex((item) => item.id === device.id)
  if (index >= 0) list.value[index] = { ...list.value[index], ...device }
  if (activeDevice.value && activeDevice.value.id === device.id) {
    activeDevice.value = { ...activeDevice.value, ...device }
    draft.value = { ...(device.properties || {}) }
  }
}

/**
 * 下发单个设备属性。
 * @param {string} key 属性名
 * @param {*} value 属性值
 * @returns {Promise<void>}
 */
async function sendProperty(key, value) {
  const device = activeDevice.value
  if (!device) return
  if (!canOperate.value) {
    ElMessage.warning('当前角色无设备操作权限，请联系运维或店长')
    return
  }
  if (isOffline.value) {
    ElMessage.warning('设备离线，指令无法下发，请先「重新绑定」恢复在线')
    return
  }
  const previous = draft.value[key]
  draft.value = { ...draft.value, [key]: value }
  sendingKey.value = key
  try {
    const updated = await deviceApi.updateProperties(device.id, { [key]: value })
    mergeDevice(updated)
    ElMessage.success(`指令已下发：${labelOf(key)} → ${displayValue(key, value)}`)
  } catch (error) {
    draft.value = { ...draft.value, [key]: previous }
    ElMessage.error(error.message || '指令下发失败')
  } finally {
    sendingKey.value = ''
  }
}

/**
 * 属性中文名。
 * @param {string} key
 * @returns {string}
 */
function labelOf(key) {
  const item = schema.value.find((prop) => prop.key === key)
  return item ? item.label : key
}

/**
 * 属性值展示（下拉选项转中文）。
 * @param {string} key
 * @param {*} value
 * @returns {string}
 */
function displayValue(key, value) {
  const item = schema.value.find((prop) => prop.key === key)
  if (item && item.options) {
    const option = item.options.find((opt) => opt.value === value)
    return option ? option.label : String(value)
  }
  if (typeof value === 'boolean') return value ? '开' : '关'
  return `${value}${(item && item.unit) || ''}`
}

/**
 * 设备自检。
 * @returns {Promise<void>}
 */
async function runCheck() {
  const device = activeDevice.value
  if (!device || checking.value) return
  checking.value = true
  checkResult.value = '正在自检，请稍候…'
  try {
    const result = await deviceApi.checkDevice(device.id)
    checkResult.value = `自检通过 · 耗时 ${result.duration}s · ${formatDateTime(new Date())}`
    ElMessage.success(`设备自检通过，耗时 ${result.duration}s`)
    if (result.device) mergeDevice(result.device)
  } catch (error) {
    checkResult.value = `自检失败：${error.message || '未知错误'}`
    ElMessage.error(error.message || '设备自检失败')
  } finally {
    checking.value = false
  }
}

/**
 * 重新绑定离线设备。
 * @returns {Promise<void>}
 */
async function rebind() {
  const device = activeDevice.value
  if (!device) return
  try {
    const updated = await deviceApi.rebindDevice(device.id)
    mergeDevice(updated)
    ElMessage.success('设备已重新绑定并恢复在线')
    await loadDevices()
  } catch (error) {
    ElMessage.error(error.message || '重新绑定失败')
  }
}

/** 表格行自检（独立于抽屉） */
async function quickCheck(row) {
  try {
    const result = await deviceApi.checkDevice(row.id)
    ElMessage.success(`「${row.room_no} 房 ${row.name}」自检通过，耗时 ${result.duration}s`)
  } catch (error) {
    ElMessage.error(error.message || '设备自检失败')
  }
}

onMounted(loadDevices)
</script>

<template>
  <div class="page">
    <PageHeader
      title="设备运维"
      icon="Cpu"
      desc="全店 200 台智能设备在线状态与远程控制（灯光 / 空调 / 窗帘 / 电视），离线设备禁止下发指令"
    >
      <template #actions>
        <el-button :loading="loading" @click="loadDevices">
          <el-icon><Refresh /></el-icon>
          <span>刷新设备</span>
        </el-button>
      </template>
    </PageHeader>

    <section class="panel">
      <div class="filter-bar">
        <el-select v-model="filters.type" placeholder="全部设备类型" clearable @change="handleSearch">
          <el-option v-for="item in typeOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>

        <el-select v-model="filters.online_status" placeholder="全部在线状态" clearable @change="handleSearch">
          <el-option label="在线" value="online" />
          <el-option label="离线" value="offline" />
        </el-select>

        <el-input
          v-model="filters.keyword"
          placeholder="设备 ID / SN / 房号 / 名称"
          clearable
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>

        <el-button type="primary" @click="handleSearch">
          <el-icon><Search /></el-icon>
          <span>查询</span>
        </el-button>
        <el-button @click="resetFilters">
          <el-icon><RefreshLeft /></el-icon>
          <span>重置</span>
        </el-button>

        <span class="filter-bar__spacer" />
        <span class="filter-bar__summary">共<strong>{{ total }}</strong>台设备</span>
      </div>
    </section>

    <section class="panel panel--flush">
      <el-table v-loading="loading" :data="list" style="width: 100%" row-key="id">
        <el-table-column label="设备" min-width="210">
          <template #default="{ row }">
            <div class="flex" style="gap: 10px">
              <span class="device-type-icon">{{ DEVICE_TYPE_ICON[row.type] || '📦' }}</span>
              <div class="flex-col" style="gap: 3px; min-width: 0">
                <span class="text-strong">{{ row.name }}</span>
                <span class="mono text-small text-muted">{{ row.id }} · {{ row.sn }}</span>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="房号" width="92">
          <template #default="{ row }">
            <span class="room-no-text">{{ row.room_no }}</span>
          </template>
        </el-table-column>

        <el-table-column label="类型" width="96">
          <template #default="{ row }">
            <el-tag size="small" effect="plain" type="info">{{ row.type_label }}</el-tag>
          </template>
        </el-table-column>

        <el-table-column label="在线状态" width="110">
          <template #default="{ row }">
            <span class="online-cell">
              <span class="dot" :class="row.online_status === 'online' ? 'dot--online' : 'dot--offline'" />
              <el-tag
                size="small"
                effect="light"
                :type="row.online_status === 'online' ? 'success' : 'info'"
              >
                {{ row.online_label || DEVICE_ONLINE_LABEL[row.online_status] }}
              </el-tag>
            </span>
          </template>
        </el-table-column>

        <el-table-column label="心跳时间" width="150">
          <template #default="{ row }">
            <span class="text-small text-muted">{{ row.last_heartbeat }}</span>
          </template>
        </el-table-column>

        <el-table-column label="固件" width="88">
          <template #default="{ row }">
            <span class="mono text-small text-muted">{{ row.firmware }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="190" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button size="small" type="primary" plain @click="openControl(row)">
                <el-icon><Setting /></el-icon>
                <span>远程控制</span>
              </el-button>
              <el-button size="small" @click="quickCheck(row)">自检</el-button>
            </div>
          </template>
        </el-table-column>

        <template #empty>
          <div class="empty-block">
            <el-icon :size="28" style="color: #b9c6d8"><Cpu /></el-icon>
            <p>暂无符合条件的设备</p>
          </div>
        </template>
      </el-table>

      <div class="pagination-bar">
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @current-change="loadDevices"
          @size-change="handleSizeChange"
        />
      </div>
    </section>

    <!-- 远程控制抽屉 -->
    <el-drawer v-model="drawerVisible" size="460px" title="设备远程控制" destroy-on-close>
      <div v-if="activeDevice" class="control">
        <div class="control__hero">
          <span class="device-type-icon device-type-icon--lg">{{ DEVICE_TYPE_ICON[activeDevice.type] || '📦' }}</span>
          <div class="control__hero-meta">
            <strong>{{ activeDevice.name }}</strong>
            <span class="text-small text-muted">
              {{ activeDevice.room_no }} 房 · {{ activeDevice.type_label }} · {{ activeDevice.id }}
            </span>
          </div>
          <el-tag size="small" :type="isOffline ? 'info' : 'success'" effect="light">
            {{ isOffline ? '离线' : '在线' }}
          </el-tag>
        </div>

        <el-alert
          v-if="isOffline"
          class="mt-12"
          type="error"
          :closable="false"
          show-icon
          title="设备离线，远程指令无法下发"
          description="请检查房间网关与网络，或点击下方「重新绑定」让设备重新上线。"
        />
        <el-alert
          v-else-if="!canOperate"
          class="mt-12"
          type="info"
          :closable="false"
          show-icon
          title="当前角色仅可查看设备状态"
          description="远程控制需要工程运维或店长权限。"
        />

        <div class="control__section">
          <div class="control__section-head">
            <h4>属性控制</h4>
            <span class="text-small text-muted">心跳：{{ activeDevice.last_heartbeat }}</span>
          </div>

          <div class="property-list">
            <div v-for="item in schema" :key="item.key" class="property-row">
              <div class="property-row__label">
                <span>{{ item.label }}</span>
                <span class="property-row__value">
                  <template v-if="item.control === 'switch'">{{ draft[item.key] ? '开启' : '关闭' }}</template>
                  <template v-else-if="item.control === 'slider'">{{ draft[item.key] }}{{ item.unit }}</template>
                  <template v-else>{{ displayValue(item.key, draft[item.key]) }}</template>
                </span>
              </div>

              <el-switch
                v-if="item.control === 'switch'"
                :model-value="Boolean(draft[item.key])"
                :disabled="isOffline || !canOperate || Boolean(sendingKey)"
                :loading="sendingKey === item.key"
                @change="(value) => sendProperty(item.key, value)"
              />

              <div v-else-if="item.control === 'slider'" class="property-row__slider">
                <el-slider
                  :model-value="Number(draft[item.key]) || 0"
                  :min="item.min"
                  :max="item.max"
                  :step="item.step"
                  :disabled="isOffline || !canOperate || Boolean(sendingKey)"
                  :show-tooltip="false"
                  @change="(value) => sendProperty(item.key, value)"
                />
              </div>

              <el-select
                v-else-if="item.control === 'select'"
                :model-value="draft[item.key]"
                class="property-row__select"
                :disabled="isOffline || !canOperate || Boolean(sendingKey)"
                @change="(value) => sendProperty(item.key, value)"
              >
                <el-option v-for="option in item.options" :key="option.value" :label="option.label" :value="option.value" />
              </el-select>
            </div>
          </div>
        </div>

        <div class="control__section">
          <div class="control__section-head">
            <h4>运维动作</h4>
          </div>
          <div class="flex" style="flex-wrap: wrap; gap: 10px">
            <el-button type="primary" plain :loading="checking" @click="runCheck">
              <el-icon><CircleCheck /></el-icon>
              <span>设备自检</span>
            </el-button>
            <el-button v-if="isOffline" type="warning" @click="rebind">
              <el-icon><Connection /></el-icon>
              <span>重新绑定</span>
            </el-button>
          </div>
          <p v-if="checkResult" class="control__result">{{ checkResult }}</p>
        </div>

        <div class="control__section">
          <div class="control__section-head">
            <h4>设备信息</h4>
          </div>
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="设备 ID">
              <span class="mono">{{ activeDevice.id }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="序列号">
              <span class="mono">{{ activeDevice.sn }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="所属房间">{{ activeDevice.room_no }} 房（{{ activeDevice.room_id }}）</el-descriptions-item>
            <el-descriptions-item label="固件版本">{{ activeDevice.firmware }}</el-descriptions-item>
          </el-descriptions>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped>
.device-type-icon {
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  border-radius: 10px;
  background: #f3f7fd;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.device-type-icon--lg {
  width: 46px;
  height: 46px;
  flex-basis: 46px;
  font-size: 24px;
  border-radius: 13px;
}

.online-cell {
  display: inline-flex;
  align-items: center;
}

.control {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.control__hero {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-radius: 12px;
  background: linear-gradient(135deg, #f2f7ff, #fbfdff);
  border: 1px solid #e3eeff;
}

.control__hero-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.control__hero-meta strong {
  font-size: 15px;
  color: var(--text-main);
}

.control__hero-meta span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.control__section {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px dashed var(--border-light);
}

.control__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
}

.control__section-head h4 {
  margin: 0;
  font-size: 14px;
  color: var(--text-main);
}

.property-list {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.property-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.property-row__label {
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: 92px;
  flex-shrink: 0;
  font-size: 13px;
  color: var(--text-regular);
}

.property-row__value {
  font-family: var(--font-number);
  font-size: 12px;
  color: var(--brand);
  font-weight: 600;
}

.property-row__slider {
  flex: 1;
  min-width: 0;
  padding-right: 6px;
}

.property-row__select {
  width: 150px;
}

.control__result {
  margin: 12px 0 0;
  padding: 10px 12px;
  border-radius: 9px;
  background: #f5f9ff;
  border: 1px solid #e4efff;
  font-size: 12px;
  color: #4a6a96;
  line-height: 1.6;
}

.pagination-bar {
  display: flex;
  justify-content: flex-end;
  padding: 14px 18px;
  border-top: 1px solid var(--border-light);
}

.empty-block p {
  margin: 8px 0 0;
}
</style>
