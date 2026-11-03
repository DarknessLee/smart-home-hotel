<script setup>
/**
 * 能耗管理：
 * - 7 / 30 天切换（dashboardStore.fetchEnergy）；
 * - KPI：总电量、总用水、总费用、日均费用；
 * - ECharts：电量柱状 + 费用折线双轴、用水量面积折线；
 * - 每日明细表格。
 */
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { formatMoney, formatNumber } from '@smart-home/utils'
import { useDashboardStore } from '@smart-home/stores'
import PageHeader from '@/components/PageHeader.vue'
import StatCard from '@/components/StatCard.vue'
import { useChart } from '@/composables/useChart.js'
import { energyMixOption, waterTrendOption } from '@/utils/chartOptions.js'

const dashboardStore = useDashboardStore()
const days = ref(30)
const loading = ref(false)

const series = computed(() => (dashboardStore.energy && dashboardStore.energy.series) || [])
const totals = computed(() => (dashboardStore.energy && dashboardStore.energy.totals) || {})

const mixOption = computed(() => energyMixOption(series.value))
const waterOption = computed(() => waterTrendOption(series.value))

const { chartRef: mixChartRef } = useChart(mixOption)
const { chartRef: waterChartRef } = useChart(waterOption)

/** 日均指标 */
const dailyAverage = computed(() => {
  const count = series.value.length || 1
  const electricity = Number(totals.value.electricity_kwh || 0)
  const water = Number(totals.value.water_m3 || 0)
  const cost = Number(totals.value.cost || 0)
  return {
    electricity: electricity / count,
    water: water / count,
    cost: cost / count
  }
})

/** 最近一天数据（用于对比说明） */
const latest = computed(() => series.value[series.value.length - 1] || {})

/**
 * 加载能耗数据。
 * @param {number} targetDays 7 / 30
 * @returns {Promise<void>}
 */
async function loadEnergy(targetDays = days.value) {
  loading.value = true
  try {
    await dashboardStore.fetchEnergy(targetDays)
    days.value = targetDays
  } catch (error) {
    ElMessage.error(error.message || '能耗数据加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => loadEnergy(30))
</script>

<template>
  <div class="page">
    <PageHeader
      title="能耗管理"
      icon="Odometer"
      desc="门店水电气能耗监控与趋势分析，支持 7 天 / 30 天区间切换（Mock 静态序列，图表视觉稳定）"
    >
      <template #actions>
        <el-radio-group v-model="days" @change="loadEnergy">
          <el-radio-button :value="7">近 7 天</el-radio-button>
          <el-radio-button :value="30">近 30 天</el-radio-button>
        </el-radio-group>
        <el-button :loading="loading" @click="loadEnergy(days)">
          <el-icon><Refresh /></el-icon>
          <span>刷新</span>
        </el-button>
      </template>
    </PageHeader>

    <!-- KPI -->
    <div class="energy-kpis">
      <StatCard
        label="总耗电量"
        :value="formatNumber(totals.electricity_kwh || 0)"
        unit="kWh"
        icon="Lightning"
        color="#fa8c16"
        soft="#fff5e6"
        :loading="loading && !totals.electricity_kwh"
        :foot="`日均 ${formatNumber(Math.round(dailyAverage.electricity))} kWh`"
      />
      <StatCard
        label="总用水量"
        :value="Number(totals.water_m3 || 0).toFixed(1)"
        unit="m³"
        icon="Pouring"
        color="#1677ff"
        soft="#e8f1ff"
        :loading="loading && !totals.water_m3"
        :foot="`日均 ${dailyAverage.water.toFixed(1)} m³`"
      />
      <StatCard
        label="总能耗费用"
        :value="formatMoney(totals.cost, { digits: 0 })"
        icon="Money"
        color="#52c41a"
        soft="#f0fbe8"
        :loading="loading && !totals.cost"
        :foot="`日均 ${formatMoney(dailyAverage.cost, { digits: 0 })}`"
      />
      <StatCard
        label="最近一日费用"
        :value="formatMoney(latest.cost, { digits: 0 })"
        icon="Wallet"
        color="#722ed1"
        soft="#f6eeff"
        :foot="latest.date ? `${latest.date}（${latest.week_day}）` : '—'"
      />
    </div>

    <!-- 图表 -->
    <div class="energy-charts">
      <section class="panel">
        <div class="panel__head">
          <h3 class="panel__title">用电量与费用趋势</h3>
          <span class="panel__extra">柱状：用电量（kWh） · 折线：费用（元）</span>
        </div>
        <div v-if="mixOption" ref="mixChartRef" class="chart" />
        <div v-else class="chart chart--empty">暂无用电数据</div>
      </section>

      <section class="panel">
        <div class="panel__head">
          <h3 class="panel__title">用水量趋势</h3>
          <span class="panel__extra">单位：m³</span>
        </div>
        <div v-if="waterOption" ref="waterChartRef" class="chart" />
        <div v-else class="chart chart--empty">暂无用水数据</div>
      </section>
    </div>

    <!-- 明细 -->
    <section class="panel panel--flush">
      <div class="panel__head panel__head--pad">
        <h3 class="panel__title">每日能耗明细</h3>
        <span class="panel__extra">共 {{ series.length }} 天 · 日均费用 {{ formatMoney(dailyAverage.cost) }}</span>
      </div>
      <el-table v-loading="loading" :data="series.slice().reverse()" max-height="360" style="width: 100%">
        <el-table-column prop="date" label="日期" width="130" />
        <el-table-column prop="week_day" label="星期" width="90" />
        <el-table-column label="用电量（kWh）" min-width="140" align="right">
          <template #default="{ row }">
            <span class="text-number">{{ formatNumber(row.electricity_kwh) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="用水量（m³）" min-width="140" align="right">
          <template #default="{ row }">
            <span class="text-number">{{ Number(row.water_m3).toFixed(1) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="费用（元）" min-width="140" align="right">
          <template #default="{ row }">
            <span class="text-number text-strong">{{ formatMoney(row.cost) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="电量占比" min-width="180">
          <template #default="{ row }">
            <el-progress
              :percentage="Math.min(100, Math.round((row.electricity_kwh / (Number(totals.electricity_kwh) || 1)) * 100))"
              :stroke-width="8"
              :show-text="false"
              color="#fa8c16"
            />
          </template>
        </el-table-column>
        <template #empty>
          <div class="empty-block">暂无能耗明细</div>
        </template>
      </el-table>
    </section>
  </div>
</template>

<style scoped>
.energy-kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.energy-charts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.panel__head--pad {
  padding: 18px 20px 12px;
}

@media (max-width: 1280px) {
  .energy-kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .energy-charts {
    grid-template-columns: 1fr;
  }
}
</style>
