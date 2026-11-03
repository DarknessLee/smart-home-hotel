/**
 * 登录态 / 用户信息 / RBAC 权限。
 *
 * 约定：组件永远不直接调用 authApi，而是通过本 store 的 actions，
 * 后期接入真实接口时组件零改动（需求文档 7.4）。
 */
import { defineStore } from 'pinia'
import { authApi, clearToken, getToken, setToken } from '@smart-home/api'
import {
  ROLE,
  ROLE_LABEL,
  isStaffRole,
  hasPermission,
  getStorage,
  setStorage,
  removeStorage,
  maskPhone
} from '@smart-home/utils'

const USER_STORAGE_KEY = 'user'

/**
 * 从本地存储恢复的会话。
 * @returns {{ token: string, user: Object|null }}
 */
function readSession() {
  return {
    token: getToken() || '',
    user: getStorage(USER_STORAGE_KEY, null)
  }
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    ...readSession(),
    loading: false
  }),

  getters: {
    /** 是否已登录 */
    isLoggedIn: (state) => Boolean(state.token && state.user),
    /** 当前角色 */
    role: (state) => (state.user && state.user.role) || '',
    /** 角色中文名 */
    roleLabel: (state) => ROLE_LABEL[state.user && state.user.role] || '未登录',
    /** 是否顾客 */
    isCustomer() {
      return this.role === ROLE.CUSTOMER
    },
    /** 是否 B 端员工 */
    isStaff() {
      return isStaffRole(this.role)
    },
    /** 展示名：优先实名，否则脱敏手机号 */
    displayName: (state) => {
      if (!state.user) return '未登录'
      return state.user.real_name || maskPhone(state.user.phone)
    },
    /** 是否已完成实名认证 */
    isVerified: (state) => Boolean(state.user && state.user.status === 'normal' && state.user.real_name),
    /** 当前入住房间 id（设备控制权依据） */
    currentRoomId: (state) => (state.user && state.user.current_room_id) || ''
  },

  actions: {
    /**
     * 判断是否拥有权限。
     * @param {string} permission 权限码
     * @returns {boolean}
     */
    can(permission) {
      return hasPermission(this.role, permission)
    },

    /**
     * 持久化会话。
     * @param {{ token?: string, user?: Object }} session
     */
    setSession({ token, user }) {
      if (token) {
        this.token = token
        setToken(token)
      }
      if (user) {
        this.user = user
        setStorage(USER_STORAGE_KEY, user)
      }
    },

    /**
     * 从本地存储恢复会话（应用启动时调用）。
     */
    restore() {
      const session = readSession()
      this.token = session.token
      this.user = session.user
    },

    /**
     * 顾客登录（手机号 + 验证码 1234）。
     * @param {{ phone: string, code: string }} payload
     * @returns {Promise<Object>}
     */
    async login(payload) {
      this.loading = true
      try {
        const data = await authApi.login(payload)
        this.setSession(data)
        return data
      } finally {
        this.loading = false
      }
    },

    /**
     * B 端员工登录（Mock 阶段按角色切换演示账号）。
     * @param {{ role: string, phone?: string }} payload
     * @returns {Promise<Object>}
     */
    async staffLogin(payload) {
      this.loading = true
      try {
        const data = await authApi.staffLogin(payload)
        this.setSession(data)
        return data
      } finally {
        this.loading = false
      }
    },

    /**
     * 刷新当前用户资料。
     * @returns {Promise<Object>}
     */
    async fetchProfile() {
      const user = await authApi.getProfile()
      this.user = user
      setStorage(USER_STORAGE_KEY, user)
      return user
    },

    /**
     * 实名认证（Mock：2 秒返回成功）。
     * @param {{ real_name: string, id_card: string, image?: string }} payload
     * @returns {Promise<Object>}
     */
    async realNameVerify(payload) {
      this.loading = true
      try {
        const user = await authApi.realName(payload)
        this.user = user
        setStorage(USER_STORAGE_KEY, user)
        return user
      } finally {
        this.loading = false
      }
    },

    /**
     * 退出登录。
     * @returns {Promise<void>}
     */
    async logout() {
      try {
        if (this.token) await authApi.logout()
      } catch (error) {
        // Mock 阶段退出失败不阻断流程
        console.warn('[auth] logout failed:', error.message)
      } finally {
        this.token = ''
        this.user = null
        clearToken()
        removeStorage(USER_STORAGE_KEY)
      }
    },

    /**
     * 更新用户局部字段（如入住后绑定房间）。
     * @param {Object} patch
     */
    patchUser(patch) {
      if (!this.user) return
      this.user = { ...this.user, ...patch }
      setStorage(USER_STORAGE_KEY, this.user)
    }
  }
})
