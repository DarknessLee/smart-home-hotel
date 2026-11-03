/**
 * 通用格式化工具（前后端展示统一口径，避免各页面各写一套）。
 */

/**
 * 金额格式化：1299 -> ¥1,299.00
 * @param {number|string} value 金额（单位：元）
 * @param {{ symbol?: boolean, digits?: number }} [options]
 * @returns {string}
 */
export function formatMoney(value, options = {}) {
  const { symbol = true, digits = 2 } = options
  const num = Number(value)
  if (!Number.isFinite(num)) return symbol ? '¥0.00' : '0.00'
  const text = num.toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })
  return symbol ? `¥${text}` : text
}

/**
 * 金额格式化为「万」单位（看板大数字用）：129900 -> 12.99万
 * @param {number} value
 * @param {number} [digits=2]
 * @returns {string}
 */
export function formatMoneyCompact(value, digits = 2) {
  const num = Number(value) || 0
  if (Math.abs(num) >= 10000) return `${(num / 10000).toFixed(digits)}万`
  return num.toFixed(digits)
}

/**
 * 日期补零
 * @param {number} value
 * @returns {string}
 */
function pad(value) {
  return String(value).padStart(2, '0')
}

/**
 * 安全转换为 Date。
 * @param {string|number|Date} input
 * @returns {Date|null}
 */
export function toDate(input) {
  if (!input) return null
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input
  // iOS 对 '2026-10-21 08:00:00' 兼容性差，统一替换为 T
  const normalized = typeof input === 'string' ? input.replace(' ', 'T') : input
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * 格式化日期：2026-10-21
 * @param {string|number|Date} input
 * @param {string} [separator='-']
 * @returns {string}
 */
export function formatDate(input, separator = '-') {
  const date = toDate(input)
  if (!date) return ''
  return [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join(separator)
}

/**
 * 格式化时间：2026-10-21 14:30
 * @param {string|number|Date} input
 * @returns {string}
 */
export function formatDateTime(input) {
  const date = toDate(input)
  if (!date) return ''
  return `${formatDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * 格式化时分：14:30
 * @param {string|number|Date} input
 * @returns {string}
 */
export function formatTime(input) {
  const date = toDate(input)
  if (!date) return ''
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * 相对时间：刚刚 / 5 分钟前 / 3 小时前 / 2026-10-21
 * @param {string|number|Date} input
 * @returns {string}
 */
export function formatRelativeTime(input) {
  const date = toDate(input)
  if (!date) return ''
  const diff = Date.now() - date.getTime()
  if (diff < 0) return formatDateTime(date)
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`
  return formatDate(date)
}

/**
 * 计算两日期间隔天数（用于房费计算）。
 * @param {string|number|Date} checkIn
 * @param {string|number|Date} checkOut
 * @returns {number} 至少 1 晚
 */
export function diffDays(checkIn, checkOut) {
  const start = toDate(checkIn)
  const end = toDate(checkOut)
  if (!start || !end) return 1
  const nights = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
  return Math.max(1, nights)
}

/**
 * 今天（YYYY-MM-DD）
 * @returns {string}
 */
export function today() {
  return formatDate(new Date())
}

/**
 * 日期偏移：addDays('2026-10-21', 3) -> '2026-10-24'
 * @param {string|number|Date} input
 * @param {number} days 可为负数
 * @returns {string}
 */
export function addDays(input, days) {
  const date = toDate(input) || new Date()
  const next = new Date(date.getTime())
  next.setDate(next.getDate() + days)
  return formatDate(next)
}

/**
 * 百分比格式化：0.8234 -> 82.3%
 * @param {number} ratio 0~1 或 0~100（>1 视为已是百分数）
 * @param {number} [digits=1]
 * @returns {string}
 */
export function formatPercent(ratio, digits = 1) {
  const num = Number(ratio)
  if (!Number.isFinite(num)) return '0%'
  const percent = num > 1 ? num : num * 100
  return `${percent.toFixed(digits)}%`
}

/**
 * 数字千分位：12345 -> 12,345
 * @param {number|string} value
 * @returns {string}
 */
export function formatNumber(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '0'
  return num.toLocaleString('zh-CN')
}

/**
 * 手机号脱敏：138****8000
 * @param {string} phone
 * @returns {string}
 */
export function maskPhone(phone) {
  const text = String(phone || '')
  if (text.length < 7) return text
  return `${text.slice(0, 3)}****${text.slice(-4)}`
}

/**
 * 身份证脱敏：110101********5678
 * @param {string} idCard
 * @returns {string}
 */
export function maskIdCard(idCard) {
  const text = String(idCard || '')
  if (text.length < 10) return text
  return `${text.slice(0, 6)}********${text.slice(-4)}`
}

/**
 * 姓名脱敏：张*明
 * @param {string} name
 * @returns {string}
 */
export function maskName(name) {
  const text = String(name || '')
  if (text.length <= 1) return text
  if (text.length === 2) return `${text[0]}*`
  return `${text[0]}${'*'.repeat(text.length - 2)}${text[text.length - 1]}`
}

/**
 * 截断文本
 * @param {string} text
 * @param {number} [max=20]
 * @returns {string}
 */
export function ellipsis(text, max = 20) {
  const value = String(text || '')
  return value.length > max ? `${value.slice(0, max)}…` : value
}
