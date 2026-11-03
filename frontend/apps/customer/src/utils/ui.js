/**
 * 轻量交互封装：统一 toast / 确认弹窗 / loading 的调用方式。
 * 页面里不再各写一套 uni.showToast 参数。
 */

/**
 * 普通提示（无图标，适合展示接口返回的文案）。
 * @param {string} title
 * @returns {void}
 */
export function toast(title) {
  uni.showToast({ title: String(title || '操作失败'), icon: 'none', duration: 2200 })
}

/**
 * 成功提示（带对勾图标，文案尽量不超过 7 个汉字）。
 * @param {string} title
 * @returns {void}
 */
export function toastSuccess(title) {
  uni.showToast({ title: String(title || '操作成功'), icon: 'success', duration: 1600 })
}

/**
 * 二次确认弹窗。
 * @param {{ title?: string, content: string, confirmText?: string, cancelText?: string }} options
 * @returns {Promise<boolean>} 用户是否确认
 */
export function confirmAction(options = {}) {
  return new Promise((resolve) => {
    uni.showModal({
      title: options.title || '提示',
      content: options.content || '',
      confirmText: options.confirmText || '确定',
      cancelText: options.cancelText || '取消',
      confirmColor: '#1677FF',
      success: (res) => resolve(Boolean(res.confirm)),
      fail: () => resolve(false)
    })
  })
}

/**
 * 显示 loading（带遮罩，避免重复点击）。
 * @param {string} [title]
 * @returns {void}
 */
export function showLoading(title = '处理中...') {
  uni.showLoading({ title, mask: true })
}

/**
 * 隐藏 loading（容错：未显示时调用不会报错）。
 * @returns {void}
 */
export function hideLoading() {
  try {
    uni.hideLoading()
  } catch (error) {
    console.warn('[ui] hideLoading failed:', error)
  }
}

/**
 * 从异常对象中读取可直接展示的文案。
 * @param {*} error
 * @param {string} [fallback]
 * @returns {string}
 */
export function errorMessage(error, fallback = '操作失败，请稍后重试') {
  if (error && typeof error.message === 'string' && error.message) return error.message
  return fallback
}
