/**
 * 应用级 UI / 运行态状态（非业务数据）。
 */
import { defineStore } from 'pinia'
import { isMockEnabled } from '@smart-home/api'
import { getStorage, setStorage } from '@smart-home/utils'

export const useAppStore = defineStore('app', {
  state: () => ({
    booted: false,
    sidebarCollapsed: Boolean(getStorage('sidebar_collapsed', false)),
    /** 上次访问的管理端菜单 key，用于登录后回跳 */
    lastMenuKey: getStorage('last_menu_key', 'dashboard')
  }),

  getters: {
    /** 当前是否 Mock 模式（B 端顶栏展示「Mock 模式」标识） */
    mockMode: () => isMockEnabled()
  },

  actions: {
    /**
     * 应用启动（各端 App.vue / main.js 调用一次）。
     */
    boot() {
      this.booted = true
    },

    /**
     * 折叠 / 展开侧边栏。
     */
    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed
      setStorage('sidebar_collapsed', this.sidebarCollapsed)
    },

    /**
     * 记录当前菜单。
     * @param {string} key
     */
    setLastMenu(key) {
      this.lastMenuKey = key
      setStorage('last_menu_key', key)
    }
  }
})
