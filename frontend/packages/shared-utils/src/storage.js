/**
 * 跨端本地存储封装。
 *
 * uni-app 环境（H5 / 小程序 / APP）使用 `uni.setStorageSync` 系列 API；
 * 纯浏览器环境（B 端管理端）自动回退到 `localStorage`。
 * 该模块不依赖任何框架，可被 shared-api / shared-stores 直接复用。
 */

const PREFIX = 'smh:'

/**
 * 是否处于 uni-app 运行时。
 * @returns {boolean}
 */
function hasUniStorage() {
  return typeof uni !== 'undefined' && typeof uni.setStorageSync === 'function'
}

/**
 * 是否处于浏览器环境。
 * @returns {boolean}
 */
function hasLocalStorage() {
  try {
    return typeof window !== 'undefined' && Boolean(window.localStorage)
  } catch (error) {
    return false
  }
}

/**
 * 读取本地存储。
 * @template T
 * @param {string} key 业务 key（无需带前缀）
 * @param {T} [defaultValue=null] 默认值
 * @returns {T}
 */
export function getStorage(key, defaultValue = null) {
  const storageKey = PREFIX + key
  try {
    if (hasUniStorage()) {
      const value = uni.getStorageSync(storageKey)
      return value === '' || value === undefined ? defaultValue : value
    }
    if (hasLocalStorage()) {
      const raw = window.localStorage.getItem(storageKey)
      if (raw === null) return defaultValue
      try {
        return JSON.parse(raw)
      } catch (error) {
        return raw
      }
    }
  } catch (error) {
    console.warn('[storage] read failed:', key, error)
  }
  return defaultValue
}

/**
 * 写入本地存储。
 * @param {string} key 业务 key
 * @param {*} value 任意可序列化值
 * @returns {void}
 */
export function setStorage(key, value) {
  const storageKey = PREFIX + key
  try {
    if (hasUniStorage()) {
      uni.setStorageSync(storageKey, value)
      return
    }
    if (hasLocalStorage()) {
      window.localStorage.setItem(storageKey, JSON.stringify(value))
    }
  } catch (error) {
    console.warn('[storage] write failed:', key, error)
  }
}

/**
 * 删除指定 key。
 * @param {string} key
 * @returns {void}
 */
export function removeStorage(key) {
  const storageKey = PREFIX + key
  try {
    if (hasUniStorage()) {
      uni.removeStorageSync(storageKey)
      return
    }
    if (hasLocalStorage()) {
      window.localStorage.removeItem(storageKey)
    }
  } catch (error) {
    console.warn('[storage] remove failed:', key, error)
  }
}

/**
 * 清空本应用前缀下的所有缓存（退出登录 / 重置演示数据）。
 * @returns {void}
 */
export function clearStorage() {
  try {
    if (hasUniStorage()) {
      const info = uni.getStorageInfoSync()
      ;(info.keys || []).forEach((key) => {
        if (String(key).startsWith(PREFIX)) uni.removeStorageSync(key)
      })
      return
    }
    if (hasLocalStorage()) {
      Object.keys(window.localStorage)
        .filter((key) => key.startsWith(PREFIX))
        .forEach((key) => window.localStorage.removeItem(key))
    }
  } catch (error) {
    console.warn('[storage] clear failed:', error)
  }
}
