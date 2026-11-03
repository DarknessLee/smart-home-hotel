/**
 * 导航辅助方法：B 端首页解析、角色选项。
 */
import { getMenusByRole, ROLE, ROLE_LABEL } from '@smart-home/utils'

/** 顶栏 / 登录页可切换的 B 端角色（顺序即展示顺序） */
export const STAFF_ROLE_OPTIONS = Object.freeze([
  { value: ROLE.STORE_MANAGER, label: ROLE_LABEL[ROLE.STORE_MANAGER], short: '店长' },
  { value: ROLE.FRONTDESK, label: ROLE_LABEL[ROLE.FRONTDESK], short: '前台' },
  { value: ROLE.FINANCE, label: ROLE_LABEL[ROLE.FINANCE], short: '财务' },
  { value: ROLE.ENGINEER, label: ROLE_LABEL[ROLE.ENGINEER], short: '运维' }
])

/**
 * 按角色解析登录后落点：优先第一个有权限的菜单（如运维没有看板权限则落到房态工作台）。
 * @param {string} role 角色
 * @returns {string} 路由地址
 */
export function resolveHomePath(role) {
  const menus = getMenusByRole(role)
  return menus.length ? menus[0].path : '/403'
}
