/**
 * ECharts 组合式封装。
 *
 * 统一处理：容器初始化、数据变化重绘、容器尺寸变化（侧边栏折叠 / 窗口缩放）、
 * 组件卸载时 dispose，避免内存泄漏。
 *
 * 兼容「图表容器由 v-if 控制（数据未到位时不渲染）」的用法：
 * option 从空变为有数据时会等待 DOM 更新后再初始化实例。
 *
 * @example
 * const option = computed(() => ({ xAxis: {}, yAxis: {}, series: [] }))
 * const { chartRef } = useChart(option)
 * // 模板：<div v-if="option" ref="chartRef" class="chart" />
 */
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'

/**
 * @param {import('vue').Ref<Object|null>} optionRef ECharts option（响应式）
 * @param {{ theme?: string }} [options]
 * @returns {{ chartRef: import('vue').Ref<HTMLElement|null> }}
 */
export function useChart(optionRef, options = {}) {
  const chartRef = ref(null)
  /** @type {import('echarts').ECharts|null} */
  let chart = null
  /** @type {ResizeObserver|null} */
  let observer = null
  let frame = 0
  let resizeBound = false

  /**
   * 渲染 / 更新图表。
   */
  function render() {
    if (!chart) return
    const option = optionRef.value
    if (!option) return
    chart.setOption(option, true)
  }

  /**
   * 窗口尺寸变化兜底（ResizeObserver 不可用时）。
   */
  function handleResize() {
    if (!chart) return
    window.cancelAnimationFrame(frame)
    frame = window.requestAnimationFrame(() => {
      if (chart) chart.resize()
    })
  }

  /**
   * 绑定尺寸监听。
   */
  function bindResize() {
    if (!resizeBound) {
      window.addEventListener('resize', handleResize)
      resizeBound = true
    }
    if (typeof ResizeObserver !== 'undefined' && chartRef.value && !observer) {
      observer = new ResizeObserver(() => {
        if (chart) chart.resize()
      })
      observer.observe(chartRef.value)
    }
  }

  /**
   * 确保实例已创建（等待 v-if 容器渲染完成）。
   * @returns {Promise<boolean>}
   */
  async function ensureChart() {
    if (chart) return true
    await nextTick()
    if (!chart && chartRef.value) {
      chart = echarts.init(chartRef.value, options.theme)
      bindResize()
      return true
    }
    return Boolean(chart)
  }

  onMounted(async () => {
    if (optionRef.value) {
      const ready = await ensureChart()
      if (ready) render()
    }
  })

  watch(
    optionRef,
    async () => {
      if (!optionRef.value) return
      const ready = await ensureChart()
      if (ready) render()
    },
    { deep: true }
  )

  onBeforeUnmount(() => {
    if (resizeBound) {
      window.removeEventListener('resize', handleResize)
      resizeBound = false
    }
    window.cancelAnimationFrame(frame)
    if (observer) {
      observer.disconnect()
      observer = null
    }
    if (chart) {
      chart.dispose()
      chart = null
    }
  })

  return { chartRef }
}

export { echarts }
