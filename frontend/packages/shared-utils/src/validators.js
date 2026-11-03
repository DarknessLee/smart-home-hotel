/**
 * 表单校验工具（C 端登录 / 实名认证、B 端新增订单等共用）。
 */

/**
 * 是否为大陆手机号。
 * @param {string} value
 * @returns {boolean}
 */
export function isPhone(value) {
  return /^1[3-9]\d{9}$/.test(String(value || '').trim())
}

/**
 * 是否为 4 位验证码（Mock 阶段固定 1234）。
 * @param {string} value
 * @returns {boolean}
 */
export function isSmsCode(value) {
  return /^\d{4}$/.test(String(value || '').trim())
}

/**
 * 是否为 18 位身份证号（校验格式与校验位，Mock 阶段仅做格式与校验位）。
 * @param {string} value
 * @returns {boolean}
 */
export function isIdCard(value) {
  const id = String(value || '').trim().toUpperCase()
  if (!/^\d{17}[\dX]$/.test(id)) return false
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
  const codes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']
  const sum = id
    .slice(0, 17)
    .split('')
    .reduce((total, char, index) => total + Number(char) * weights[index], 0)
  return codes[sum % 11] === id[17]
}

/**
 * 是否为合法中文姓名（2~15 个字符，允许 ·）。
 * @param {string} value
 * @returns {boolean}
 */
export function isRealName(value) {
  return /^[\u4e00-\u9fa5·]{2,15}$/.test(String(value || '').trim())
}

/**
 * 是否为空字符串。
 * @param {*} value
 * @returns {boolean}
 */
export function isEmpty(value) {
  if (value === null || value === undefined) return true
  return String(value).trim() === ''
}

/**
 * 日期区间是否合法（离店晚于入住）。
 * @param {string} checkIn
 * @param {string} checkOut
 * @returns {boolean}
 */
export function isDateRangeValid(checkIn, checkOut) {
  if (!checkIn || !checkOut) return false
  return new Date(checkOut).getTime() > new Date(checkIn).getTime()
}
