/**
 * 认证相关接口（C 端 + B 端共用）。
 * Mock：任意手机号 + 验证码 1234 即可登录。
 */
import { http } from '../http.js'

export const authApi = {
  /**
   * 顾客登录（手机号 + 验证码）。
   * @param {{ phone: string, code: string }} data
   * @returns {Promise<{ token: string, user: Object }>}
   */
  login(data) {
    return http.post('/auth/login', data)
  },
  /**
   * B 端员工登录（Mock 阶段直接按角色切换演示账号）。
   * @param {{ role: string, phone?: string }} data
   * @returns {Promise<{ token: string, user: Object }>}
   */
  staffLogin(data) {
    return http.post('/auth/staff-login', data)
  },
  /**
   * 获取当前登录用户。
   * @returns {Promise<Object>}
   */
  getProfile() {
    return http.get('/auth/profile')
  },
  /**
   * 实名认证（Mock：2 秒后成功）。
   * @param {{ real_name: string, id_card: string, image?: string }} data
   * @returns {Promise<Object>}
   */
  realName(data) {
    return http.post('/auth/real-name', data)
  },
  /**
   * 退出登录。
   * @returns {Promise<null>}
   */
  logout() {
    return http.post('/auth/logout')
  },
  /**
   * 演示账号列表（登录页展示）。
   * @returns {Promise<Object>}
   */
  getDemoAccounts() {
    return http.get('/auth/demo-accounts')
  }
}
