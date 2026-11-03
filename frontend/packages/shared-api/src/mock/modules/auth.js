/**
 * 认证 / 入住的 Mock 接口。
 * 需求文档 4.1.1：手机号验证码登录（任意手机号 + 验证码 1234）；
 * 实名认证上传任意图片，模拟 2 秒后认证成功。
 */
import { MockError, currentUser, requireUser } from '../helpers.js'
import { db, findUserByPhone, formatDateTime } from '../db.js'

/**
 * 判断角色是否为 B 端员工角色。
 * @param {string} role
 * @returns {boolean}
 */
function isStaffRole(role) {
  return ['store_manager', 'frontdesk', 'finance', 'engineer'].includes(role)
}

/**
 * 生成 Mock token。
 * @param {Object} user
 * @returns {string}
 */
function issueToken(user) {
  return `mock-token-${user.id}`
}

/**
 * 组装登录响应。
 * @param {Object} user
 * @returns {{ token: string, user: Object }}
 */
function authPayload(user) {
  return {
    token: issueToken(user),
    user: { ...user }
  }
}

/**
 * 按角色查找预置员工。
 * @param {string} role
 * @returns {Object|undefined}
 */
function findStaffByRole(role) {
  return db.users.find((user) => user.role === role)
}

/** @type {Array<Object>} */
export const authMock = [
  {
    method: 'POST',
    path: '/auth/login',
    delay: 420,
    /**
     * 顾客登录：任意手机号 + 验证码 1234。
     * @param {{ body: { phone?: string, code?: string } }} ctx
     */
    handler: ({ body }) => {
      const phone = String(body.phone || '').trim()
      const code = String(body.code || '').trim()
      if (!/^1[3-9]\d{9}$/.test(phone)) throw new MockError(1001, '请输入正确的手机号')
      if (code !== '1234') throw new MockError(1002, '验证码错误，Mock 阶段请输入 1234')

      let user = findUserByPhone(phone)
      if (!user) {
        user = {
          id: `U${Date.now()}`,
          phone,
          real_name: '',
          id_card: '',
          status: 'unverified',
          role: 'customer',
          current_room_id: '',
          created_at: formatDateTime(Date.now())
        }
        db.users.push(user)
      }
      if (isStaffRole(user.role)) {
        throw new MockError(1003, '该账号为员工账号，请前往 B 端管理后台登录')
      }
      return authPayload(user)
    }
  },
  {
    method: 'POST',
    path: '/auth/staff-login',
    delay: 420,
    /**
     * B 端登录（Mock 阶段直接按角色切换演示账号）。
     * @param {{ body: { role?: string, phone?: string } }} ctx
     */
    handler: ({ body }) => {
      const role = String(body.role || '').trim()
      if (!isStaffRole(role)) throw new MockError(1004, '请选择有效的员工角色')
      const user = findStaffByRole(role)
      if (!user) throw new MockError(1005, '未找到该角色对应的演示账号')
      return authPayload(user)
    }
  },
  {
    method: 'GET',
    path: '/auth/profile',
    handler: ({ headers }) => {
      const user = requireUser(headers)
      return { ...user }
    }
  },
  {
    method: 'POST',
    path: '/auth/real-name',
    delay: 2000,
    /**
     * 实名认证（Mock：上传任意图片，2 秒后成功）。
     * @param {{ body: { real_name?: string, id_card?: string, image?: string }, headers: Object }} ctx
     */
    handler: ({ body, headers }) => {
      const user = requireUser(headers)
      const realName = String(body.real_name || '').trim()
      const idCard = String(body.id_card || '').trim().toUpperCase()
      if (!/^[\u4e00-\u9fa5·]{2,15}$/.test(realName)) throw new MockError(1006, '请输入 2~15 位中文姓名')
      if (!/^\d{17}[\dX]$/.test(idCard)) throw new MockError(1007, '请输入 18 位有效身份证号')
      user.real_name = realName
      user.id_card = idCard
      user.status = 'normal'
      return { ...user }
    }
  },
  {
    method: 'POST',
    path: '/auth/logout',
    delay: 120,
    handler: () => null
  },
  {
    method: 'GET',
    path: '/auth/demo-accounts',
    handler: () => {
      const staff = db.users.filter((user) => isStaffRole(user.role)).map((user) => ({
        role: user.role,
        phone: user.phone,
        name: user.real_name
      }))
      return {
        customer: { phone: '13800138000', code: '1234' },
        staff
      }
    }
  },
  {
    method: 'GET',
    path: '/auth/me',
    handler: ({ headers }) => {
      const user = currentUser(headers)
      return user ? { ...user } : null
    }
  }
]
