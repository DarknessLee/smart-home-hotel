/**
 * ECharts option 构造器（看板 / 能耗共用）。
 * 统一坐标轴、网格、配色，保证全站图表视觉一致。
 */
import { echarts } from '@/composables/useChart.js'

const AXIS_LABEL = { color: '#8a97ab', fontSize: 11 }
const AXIS_LINE = { lineStyle: { color: '#e7ecf5' } }
const SPLIT_LINE = { lineStyle: { color: '#eef2f8', type: 'dashed' } }
const LEGEND = {
  top: 4,
  right: 4,
  icon: 'roundRect',
  itemWidth: 10,
  itemHeight: 10,
  itemGap: 16,
  textStyle: { color: '#5c6b82', fontSize: 12 }
}

/**
 * 横轴日期展示（MM-DD）。
 * @param {Array<{ date: string }>} list
 * @returns {string[]}
 */
function dateLabels(list) {
  return list.map((item) => (item.date ? String(item.date).slice(5) : ''))
}

/**
 * 根据数据量计算横轴标签间隔，避免 30 天标签重叠。
 * @param {number} length
 * @returns {number}
 */
function labelInterval(length) {
  return Math.max(0, Math.ceil(length / 8) - 1)
}

/**
 * 营收（柱）+ 入住率（双 Y 轴折线）。
 * @param {Array<{ date: string, week_day: string, revenue: number, occupancy_percent: number }>} list
 * @returns {Object|null}
 */
export function revenueTrendOption(list) {
  if (!Array.isArray(list) || !list.length) return null
  const labels = dateLabels(list)
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(23, 33, 50, 0.92)',
      borderWidth: 0,
      textStyle: { color: '#fff', fontSize: 12 },
      padding: [10, 14]
    },
    legend: { ...LEGEND, data: ['营收(元)', '入住率(%)'] },
    grid: { left: 8, right: 8, top: 52, bottom: 4, containLabel: true },
    xAxis: {
      type: 'category',
      data: labels,
      boundaryGap: true,
      axisTick: { show: false },
      axisLine: AXIS_LINE,
      axisLabel: { ...AXIS_LABEL, interval: labelInterval(labels.length) }
    },
    yAxis: [
      {
        type: 'value',
        axisLabel: { ...AXIS_LABEL, formatter: (value) => (value >= 10000 ? `${value / 10000}w` : value) },
        splitLine: SPLIT_LINE,
        axisLine: { show: false }
      },
      {
        type: 'value',
        min: 0,
        max: 100,
        axisLabel: { ...AXIS_LABEL, formatter: '{value}%' },
        splitLine: { show: false },
        axisLine: { show: false }
      }
    ],
    series: [
      {
        name: '营收(元)',
        type: 'bar',
        barMaxWidth: 16,
        data: list.map((item) => Number(item.revenue) || 0),
        itemStyle: {
          borderRadius: [5, 5, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#3b8cff' },
            { offset: 1, color: '#a9ccff' }
          ])
        },
        emphasis: { itemStyle: { color: '#1677ff' } }
      },
      {
        name: '入住率(%)',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        showSymbol: false,
        data: list.map((item) => Number(item.occupancy_percent) || 0),
        lineStyle: { width: 2.5, color: '#faad14' },
        itemStyle: { color: '#faad14', borderWidth: 2, borderColor: '#fff' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(250, 173, 20, 0.18)' },
            { offset: 1, color: 'rgba(250, 173, 20, 0)' }
          ])
        }
      }
    ]
  }
}

/**
 * 房态分布环形饼图。
 * @param {Array<{ status: string, label: string, color: string, count: number, percent: number }>} list
 * @param {number} total
 * @returns {Object|null}
 */
export function roomDistributionOption(list, total) {
  if (!Array.isArray(list) || !list.length) return null
  return {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(23, 33, 50, 0.92)',
      borderWidth: 0,
      textStyle: { color: '#fff', fontSize: 12 },
      formatter: '{b}<br/>{c} 间 · {d}%'
    },
    title: {
      text: String(total || 0),
      subtext: '总房间数',
      left: 'center',
      top: '34%',
      textStyle: { color: '#1f2d3d', fontSize: 26, fontWeight: 700 },
      subtextStyle: { color: '#9aa7ba', fontSize: 12 }
    },
    legend: {
      bottom: 0,
      icon: 'circle',
      itemWidth: 9,
      itemHeight: 9,
      itemGap: 12,
      textStyle: { color: '#5c6b82', fontSize: 12 }
    },
    series: [
      {
        name: '房态分布',
        type: 'pie',
        radius: ['56%', '74%'],
        center: ['50%', '42%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 5 },
        label: { show: false },
        labelLine: { show: false },
        emphasis: {
          scaleSize: 6,
          label: {
            show: true,
            formatter: '{b}\n{d}%',
            fontSize: 12,
            fontWeight: 600,
            color: '#1f2d3d'
          }
        },
        data: list.map((item) => ({
          name: item.label,
          value: item.count,
          itemStyle: { color: item.color }
        }))
      }
    ]
  }
}

/**
 * 客单价 ADR 趋势（折线）。
 * @param {Array<{ date: string, adr: number }>} list
 * @returns {Object|null}
 */
export function adrTrendOption(list) {
  if (!Array.isArray(list) || !list.length) return null
  const labels = dateLabels(list)
  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(23, 33, 50, 0.92)',
      borderWidth: 0,
      textStyle: { color: '#fff', fontSize: 12 },
      valueFormatter: (value) => `¥${value}`
    },
    grid: { left: 8, right: 16, top: 24, bottom: 4, containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: labels,
      axisTick: { show: false },
      axisLine: AXIS_LINE,
      axisLabel: { ...AXIS_LABEL, interval: labelInterval(labels.length) }
    },
    yAxis: {
      type: 'value',
      scale: true,
      name: 'ADR(元)',
      nameTextStyle: { color: '#9aa7ba', fontSize: 11, padding: [0, 0, 0, 8] },
      axisLabel: AXIS_LABEL,
      splitLine: SPLIT_LINE,
      axisLine: { show: false }
    },
    series: [
      {
        name: 'ADR',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: list.map((item) => Number(item.adr) || 0),
        lineStyle: { width: 3, color: '#722ed1' },
        itemStyle: { color: '#722ed1' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(114, 46, 209, 0.22)' },
            { offset: 1, color: 'rgba(114, 46, 209, 0)' }
          ])
        }
      }
    ]
  }
}

/**
 * 能耗：电量柱状图 + 费用折线（双 Y 轴）。
 * @param {Array<{ date: string, electricity_kwh: number, cost: number }>} series
 * @returns {Object|null}
 */
export function energyMixOption(series) {
  if (!Array.isArray(series) || !series.length) return null
  const labels = dateLabels(series)
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(23, 33, 50, 0.92)',
      borderWidth: 0,
      textStyle: { color: '#fff', fontSize: 12 }
    },
    legend: { ...LEGEND, data: ['用电量(kWh)', '费用(元)'] },
    grid: { left: 8, right: 8, top: 52, bottom: 4, containLabel: true },
    xAxis: {
      type: 'category',
      data: labels,
      axisTick: { show: false },
      axisLine: AXIS_LINE,
      axisLabel: { ...AXIS_LABEL, interval: labelInterval(labels.length) }
    },
    yAxis: [
      {
        type: 'value',
        axisLabel: AXIS_LABEL,
        splitLine: SPLIT_LINE,
        axisLine: { show: false }
      },
      {
        type: 'value',
        axisLabel: AXIS_LABEL,
        splitLine: { show: false },
        axisLine: { show: false }
      }
    ],
    series: [
      {
        name: '用电量(kWh)',
        type: 'bar',
        barMaxWidth: 18,
        data: series.map((item) => Number(item.electricity_kwh) || 0),
        itemStyle: {
          borderRadius: [5, 5, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#36cfc9' },
            { offset: 1, color: '#b5f0ed' }
          ])
        }
      },
      {
        name: '费用(元)',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        showSymbol: false,
        data: series.map((item) => Number(item.cost) || 0),
        lineStyle: { width: 2.5, color: '#fa8c16' },
        itemStyle: { color: '#fa8c16' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(250, 140, 22, 0.18)' },
            { offset: 1, color: 'rgba(250, 140, 22, 0)' }
          ])
        }
      }
    ]
  }
}

/**
 * 用水量趋势（面积折线）。
 * @param {Array<{ date: string, water_m3: number }>} series
 * @returns {Object|null}
 */
export function waterTrendOption(series) {
  if (!Array.isArray(series) || !series.length) return null
  const labels = dateLabels(series)
  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(23, 33, 50, 0.92)',
      borderWidth: 0,
      textStyle: { color: '#fff', fontSize: 12 },
      valueFormatter: (value) => `${value} m³`
    },
    grid: { left: 8, right: 16, top: 24, bottom: 4, containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: labels,
      axisTick: { show: false },
      axisLine: AXIS_LINE,
      axisLabel: { ...AXIS_LABEL, interval: labelInterval(labels.length) }
    },
    yAxis: {
      type: 'value',
      name: '用水量(m³)',
      nameTextStyle: { color: '#9aa7ba', fontSize: 11, padding: [0, 0, 0, 8] },
      axisLabel: AXIS_LABEL,
      splitLine: SPLIT_LINE,
      axisLine: { show: false }
    },
    series: [
      {
        name: '用水量',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: series.map((item) => Number(item.water_m3) || 0),
        lineStyle: { width: 3, color: '#1677ff' },
        itemStyle: { color: '#1677ff' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(22, 119, 255, 0.24)' },
            { offset: 1, color: 'rgba(22, 119, 255, 0)' }
          ])
        }
      }
    ]
  }
}
