<script setup>
/**
 * 经营看板：
 * - 8 个 KPI 指标（今日 / 本月营收、入住率、ADR、今日入住退房、待处理告警、平均评分）；
 * - ECharts：30 天营收柱状 + 入住率双轴折线、房态分布环形饼图、ADR 趋势折线；
 * - 最近订单表格 + 待处理告警列表。
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ALARM_LEVEL_LABEL,
  ORDER_STATUS_TAG,
  ROOM_STATUS_COLOR,
  ROOM_STATUS_LABEL,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatRelativeTime
} from '@smart-home/utils'
import { useAlarmStore, useDashboardStore, useOrderStore } from '@smart-home/stores'
import PageHeader from '@/components/PageHeader.vue'
import StatCard from '@/components/StatCard.vue'
import { useChart } from '@/composables/useChart.js'
import { adrTrendOption, revenueTrendOption, roomDistributionOption } from '@/utils/chartOptions.js'

const router = useRouter()
const dashboardStore = useDashboardStore()
const orderStore = useOrderStore()
const alarmStore = useAlarmStore()

const loading = ref(false)
const updatedAt = ref('')

const overview = computed(() => dashboardStore.overview || {})
const recentOrders = computed(() => orderStore.list.slice(0, 6))
const pendingAlarms = computed(() =>
  alarmStore.list.filter((alarm) => alarm.status === 'pending').slice(0, 4)
)

const pieTotal = computed(() => dashboardStore.distributionTotal || overview.value.room_total || 0)

/** 图表 option */
const revenueOption = computed(() => revenueTrendOption(dashboardStore.trend))
const distributionOption = computed(() =>
  roomDistributionOption(dashboardStore.distribution, pieTotal.value)
)
const adrOption = computed(() => adrTrendOption(dashboardStore.trend))

const { chartRef: revenueChartRef } = useChart(revenueOption)
const { chartRef: distributionChartRef } = useChart(distributionOption)
const { chartRef: adrChartRef } = useChart(adrOption)

/** 房态分布图例（与饼图同源） */
const distributionLegend = computed(() => dashboardStore.distribution)

/** 房态概览（overview 字段名与房态值的映射） */
const roomStatusOverview = computed(() => {
  const fieldMap = {
    vacant_ready: 'room_vacant',
    reserved: 'room_reserved',
    occupied: 'room_occupied',
    dirty: 'room_dirty',
    maintenance: 'room_maintenance'
  }
  const total = pieTotal.value || 1
  return Object.keys(fieldMap).map((status) => {
    const count = Number(overview.value[fieldMap[status]] || 0)
    return {
      status,
      label: ROOM_STATUS_LABEL[status],
      color: ROOM_STATUS_COLOR[status],
      count,
      percent: Math.min(100, Math.round((count / total) * 100))
    }
  })
})

/**
 * 加载看板全部数据。
 * @returns {Promise<void>}
 */
async function loadAll() {
  loading.value = true
  try {
    await Promise.all([
      dashboardStore.fetchAll(30),
      orderStore.fetchOrders({ page: 1, page_size: 6 }),
      alarmStore.fetchAlarms()
    ])
    updatedAt.value = formatDateTime(new Date())
  } catch (error) {
    ElMessage.error(error.message || '看板数据加载失败')
  } finally {
    loading.value = false
  }
}

/**
 * 跳转订单管理并按订单号过滤。
 * @param {Object} order
 */
function goOrder(order) {
  router.push({ path: '/orders', query: { keyword: order.order_no } })
}

onMounted(loadAll)
</script>

<template>
  <div class="page">
    <PageHeader
      title="经营看板"
      icon="DataLine"
      desc="门店核心经营指标与趋势总览，数据每 30 天滚动统计（Mock 演示数据）"
    >
      <template #actions>
        <span v-if="updatedAt" class="text-small text-muted nowrap">更新于 {{ updatedAt }}</span>
        <el-button :loading="loading" type="primary" plain @click="loadAll">
          <el-icon><Refresh /></el-icon>
          <span>刷新数据</span>
        </el-button>
      </template>
    </PageHeader>

    <!-- KPI 指标 -->
    <div class="kpi-grid">
      <StatCard
        label="今日营收"
        :value="formatMoney(overview.revenue_today, { digits: 0 })"
        icon="Money"
        color="#1677ff"
        soft="#e8f1ff"
        :loading="loading && !overview.revenue_today"
        :foot="`近 30 天累计 ${formatMoney(overview.revenue_month, { digits: 0 })}`"
      />
      <StatCard
        label="本月营收"
        :value="formatMoney(overview.revenue_month, { digits: 0 })"
        icon="Wallet"
        color="#13c2c2"
        soft="#e6fffb"
        :loading="loading && !overview.revenue_month"
        :foot="`共 ${formatNumber(overview.total_orders)} 笔订单`"
      />
      <StatCard
        label="入住率"
        :value="(Number(overview.occupancy_rate || 0) * 100).toFixed(1)"
        unit="%"
        icon="PieChart"
        color="#52c41a"
        soft="#f0fbe8"
        :loading="loading && !overview.room_total"
        :foot="`在住 ${overview.room_occupied || 0} / 共 ${overview.room_total || 0} 间`"
      />
      <StatCard
        label="平均房价 ADR"
        :value="formatMoney(overview.adr, { digits: 0 })"
        icon="PriceTag"
        color="#722ed1"
        soft="#f6eeff"
        :loading="loading && !overview.adr"
        foot="近 30 天平均客单价"
      />
      <StatCard
        label="今日入住"
        :value="overview.today_check_in || 0"
        unit="间"
        icon="House"
        color="#fa8c16"
        soft="#fff5e6"
        :foot="`今日预抵 ${overview.today_check_in || 0} 间`"
      />
      <StatCard
        label="今日退房"
        :value="overview.today_check_out || 0"
        unit="间"
        icon="Van"
        color="#2f54eb"
        soft="#eef1ff"
        :foot="`待处理方案 ${overview.pending_plans || 0} 个`"
      />
      <StatCard
        label="待处理告警"
        :value="overview.pending_alarms || 0"
        unit="条"
        icon="Warning"
        color="#f5222d"
        soft="#fff1f0"
        :danger="(overview.pending_alarms || 0) > 0"
        :foot="(overview.pending_alarms || 0) > 0 ? '请及时前往告警中心处理' : '暂无待处理告警'"
      />
      <StatCard
        label="平均评分"
        :value="Number(overview.avg_rating || 0).toFixed(1)"
        unit="分"
        icon="Star"
        color="#faad14"
        soft="#fffbe6"
        :foot="`共 ${formatNumber(overview.total_orders)} 笔订单 · ${overview.guest_count || 0} 位在住客人`"
      />
    </div>

    <!-- 营收 + 房态分布 -->
    <div class="chart-row chart-row--main">
      <section class="panel">
        <div class="panel__head">
          <h3 class="panel__title">近 30 天营收与入住率</h3>
          <span class="panel__extra">柱状：营收（元） · 折线：入住率（%）</span>
        </div>
        <div v-if="revenueOption" ref="revenueChartRef" class="chart" />
        <div v-else class="chart chart--empty">暂无趋势数据</div>
      </section>

      <section class="panel">
        <div class="panel__head">
          <h3 class="panel__title">实时房态分布</h3>
          <span class="panel__extra">共 {{ pieTotal }} 间</span>
        </div>
        <div v-if="distributionOption" ref="distributionChartRef" class="chart" />
        <div v-else class="chart chart--empty">暂无房态数据</div>
        <div class="distribution-legend">
          <span v-for="item in distributionLegend" :key="item.status" class="legend__item">
            <span class="legend__dot" :style="{ background: item.color, '--legend-soft': `${item.color}22` }" />
            {{ item.label }}
            <span class="legend__count">{{ item.count }}</span>
          </span>
        </div>
      </section>
    </div>

    <!-- ADR 趋势 -->
    <div class="chart-row chart-row--adr">
      <section class="panel">
        <div class="panel__head">
          <h3 class="panel__title">客单价（ADR）趋势</h3>
          <span class="panel__extra">单位：元 / 间夜</span>
        </div>
        <div v-if="adrOption" ref="adrChartRef" class="chart chart--sm" />
        <div v-else class="chart chart--sm chart--empty">暂无 ADR 数据</div>
      </section>

      <section class="panel">
        <div class="panel__head">
          <h3 class="panel__title">房态概览</h3>
          <router-link to="/rooms" class="panel__extra">前往房态工作台 →</router-link>
        </div>
        <ul class="room-status-list">
          <li v-for="item in roomStatusOverview" :key="item.status">
            <span class="legend__dot" :style="{ background: item.color, '--legend-soft': `${item.color}22` }" />
            <span class="room-status-list__label">{{ item.label }}</span>
            <span class="room-status-list__bar">
              <i :style="{ width: `${item.percent}%`, background: item.color }" />
            </span>
            <strong class="text-number">{{ item.count }}</strong>
          </li>
        </ul>
      </section>
    </div>

    <!-- 最近订单 + 待处理告警 -->
    <div class="chart-row chart-row--bottom">
      <section class="panel panel--flush">
        <div class="panel__head panel__head--pad">
          <h3 class="panel__title">最近订单</h3>
          <router-link to="/orders" class="panel__extra">查看全部订单 →</router-link>
        </div>
        <el-table
          v-loading="loading"
          :data="recentOrders"
          size="small"
          :show-header="true"
          style="width: 100%"
          @row-click="goOrder"
        >
          <el-table-column label="订单号" min-width="160">
            <template #default="{ row }">
              <span class="code-chip">{{ row.order_no }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="guest_name" label="客人" min-width="92" />
          <el-table-column prop="room_no" label="房号" width="76">
            <template #default="{ row }">
              <span class="room-no-text">{{ row.room_no }}</span>
            </template>
          </el-table-column>
          <el-table-column label="金额" width="104" align="right">
            <template #default="{ row }">
              <span class="text-number text-strong">{{ formatMoney(row.amount, { digits: 0 }) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="96" align="center">
            <template #default="{ row }">
              <el-tag :type="ORDER_STATUS_TAG[row.status] || 'info'" size="small" effect="light">
                {{ row.status_label }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="创建时间" width="138">
            <template #default="{ row }">
              <span class="text-small text-muted">{{ row.created_at }}</span>
            </template>
          </el-table-column>
          <template #empty>
            <div class="empty-block">暂无订单数据</div>
          </template>
        </el-table>
      </section>

      <section class="panel">
        <div class="panel__head">
          <h3 class="panel__title">待处理告警</h3>
          <router-link to="/alarms" class="panel__extra">告警中心 →</router-link>
        </div>

        <ul v-if="pendingAlarms.length" class="alarm-list">
          <li v-for="alarm in pendingAlarms" :key="alarm.id" class="alarm-item" @click="router.push('/alarms')">
            <span
              class="alarm-item__level"
              :class="{
                'is-high': alarm.level === 'high',
                'is-medium': alarm.level === 'medium',
                'is-low': alarm.level === 'low'
              }"
            >
              {{ ALARM_LEVEL_LABEL[alarm.level] || '一般' }}
            </span>
            <div class="alarm-item__body">
              <div class="alarm-item__title">
                <strong>{{ alarm.type_label }}</strong>
                <span class="text-small text-muted">{{ alarm.room_no }} 房</span>
              </div>
              <p>{{ alarm.content }}</p>
              <span class="text-small text-muted">{{ formatRelativeTime(alarm.created_at) }}</span>
            </div>
          </li>
        </ul>
        <div v-else class="empty-block">
          <el-icon :size="26" style="color: #52c41a"><CircleCheckFilled /></el-icon>
          <p>暂无待处理告警，门店运行良好</p>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.chart-row {
  display: grid;
  gap: 16px;
}

.chart-row--main {
  grid-template-columns: minmax(0, 2.05fr) minmax(0, 1fr);
}

.chart-row--adr {
  grid-template-columns: minmax(0, 2.05fr) minmax(0, 1fr);
}

.chart-row--bottom {
  grid-template-columns: minmax(0, 2.05fr) minmax(0, 1fr);
}

.panel__head--pad {
  padding: 18px 20px 0;
}

.distribution-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  margin-top: 4px;
  padding-top: 12px;
  border-top: 1px dashed var(--border-light);
}

.room-status-list {
  list-style: none;
  margin: 0;
  padding: 4px 0 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.room-status-list li {
  display: flex;
  align-items: center;
  gap: 10px;
}

.room-status-list__label {
  width: 54px;
  font-size: 12.5px;
  color: var(--text-regular);
  flex-shrink: 0;
}

.room-status-list__bar {
  flex: 1;
  height: 8px;
  border-radius: 6px;
  background: #f0f4fa;
  overflow: hidden;
}

.room-status-list__bar i {
  display: block;
  height: 100%;
  border-radius: 6px;
  transition: width 0.5s ease;
}

.room-status-list strong {
  width: 34px;
  text-align: right;
  font-size: 13px;
  color: var(--text-main);
}

.alarm-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.alarm-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  background: #fbfcfe;
  border: 1px solid #eef2f8;
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.alarm-item:hover {
  border-color: #cfe0fb;
  box-shadow: 0 6px 16px rgba(22, 119, 255, 0.1);
}

.alarm-item__level {
  flex: 0 0 auto;
  height: 22px;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  background: #f0f2f5;
  color: #7a8699;
}

.alarm-item__level.is-high {
  background: #fff1f0;
  color: #f5222d;
}

.alarm-item__level.is-medium {
  background: #fffbe6;
  color: #d48806;
}

.alarm-item__body {
  min-width: 0;
  flex: 1;
}

.alarm-item__title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.alarm-item__title strong {
  font-size: 13px;
  color: var(--text-main);
}

.alarm-item__body p {
  margin: 0 0 6px;
  font-size: 12px;
  line-height: 1.55;
  color: var(--text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.empty-block p {
  margin: 8px 0 0;
}

@media (max-width: 1500px) {
  .kpi-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 1280px) {
  .kpi-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .chart-row--main,
  .chart-row--adr,
  .chart-row--bottom {
    grid-template-columns: 1fr;
  }
}
</style>
