/**
 * RBAC 权限模型（需求文档第 2 章）。
 *
 * 说明：
 * - 权限码统一使用 `端:资源:动作` 格式；
 * - C 端页面通过 `c:*` 权限控制「只有已入住顾客能控制自己房间设备」；
 * - B 端菜单 / 路由 / 按钮通过 `b:*` 权限控制（配合 router meta.permission）；
 * - Mock 阶段只在 UI 层做权限控制，后端真实权限校验后续补上。
 */
import { ROLE, ROLE_LABEL } from './constants.js'

/** 权限码字典 */
export const PERMISSION = Object.freeze({
  // C 端
  C_ROOM_BOOK: 'c:room:book',
  C_ORDER_OWN: 'c:order:own',
  C_DEVICE_OWN_ROOM: 'c:device:own_room',
  C_SCENE_OWN_ROOM: 'c:scene:own_room',
  C_CHECKIN: 'c:checkin',
  // B 端
  B_DASHBOARD_VIEW: 'b:dashboard:view',
  B_ROOM_VIEW: 'b:room:view',
  B_ROOM_OPERATE: 'b:room:operate',
  B_ORDER_VIEW: 'b:order:view',
  B_ORDER_OPERATE: 'b:order:operate',
  B_DEVICE_VIEW: 'b:device:view',
  B_DEVICE_OPERATE: 'b:device:operate',
  B_ALARM_VIEW: 'b:alarm:view',
  B_ALARM_HANDLE: 'b:alarm:handle',
  B_ENERGY_VIEW: 'b:energy:view',
  B_PLAN_VIEW: 'b:plan:view',
  B_PLAN_CREATE: 'b:plan:create',
  B_PLAN_APPROVE: 'b:plan:approve',
  B_FINANCE_VIEW: 'b:finance:view',
  B_FINANCE_OPERATE: 'b:finance:operate',
  B_STAFF_MANAGE: 'b:staff:manage'
})

/** 角色 -> 权限码列表（'*' 表示全部） */
export const ROLE_PERMISSIONS = Object.freeze({
  [ROLE.CUSTOMER]: [
    PERMISSION.C_ROOM_BOOK,
    PERMISSION.C_ORDER_OWN,
    PERMISSION.C_DEVICE_OWN_ROOM,
    PERMISSION.C_SCENE_OWN_ROOM,
    PERMISSION.C_CHECKIN
  ],
  [ROLE.STORE_MANAGER]: ['*'],
  [ROLE.FRONTDESK]: [
    PERMISSION.B_DASHBOARD_VIEW,
    PERMISSION.B_ROOM_VIEW,
    PERMISSION.B_ROOM_OPERATE,
    PERMISSION.B_ORDER_VIEW,
    PERMISSION.B_ORDER_OPERATE,
    PERMISSION.B_DEVICE_VIEW,
    PERMISSION.B_ALARM_VIEW,
    PERMISSION.B_ALARM_HANDLE
  ],
  [ROLE.FINANCE]: [
    PERMISSION.B_DASHBOARD_VIEW,
    PERMISSION.B_ORDER_VIEW,
    PERMISSION.B_FINANCE_VIEW,
    PERMISSION.B_FINANCE_OPERATE
  ],
  [ROLE.ENGINEER]: [
    PERMISSION.B_ROOM_VIEW,
    PERMISSION.B_DEVICE_VIEW,
    PERMISSION.B_DEVICE_OPERATE,
    PERMISSION.B_ALARM_VIEW,
    PERMISSION.B_ALARM_HANDLE,
    PERMISSION.B_ENERGY_VIEW,
    PERMISSION.B_PLAN_VIEW
  ]
})

/**
 * B 端菜单表：路由、菜单、权限、图标一次配置，避免三处不同步。
 * @typedef {Object} AdminMenu
 * @property {string} key 唯一标识
 * @property {string} title 菜单标题
 * @property {string} path 路由地址
 * @property {string} icon Element Plus 图标名
 * @property {string} permission 权限码
 * @property {string} [group] 菜单分组
 */
export const ADMIN_MENUS = Object.freeze([
  {
    key: 'dashboard',
    title: '经营看板',
    path: '/dashboard',
    icon: 'DataLine',
    permission: PERMISSION.B_DASHBOARD_VIEW,
    group: '经营分析'
  },
  {
    key: 'rooms',
    title: '房态工作台',
    path: '/rooms',
    icon: 'Grid',
    permission: PERMISSION.B_ROOM_VIEW,
    group: '前台运营'
  },
  {
    key: 'orders',
    title: '订单管理',
    path: '/orders',
    icon: 'Tickets',
    permission: PERMISSION.B_ORDER_VIEW,
    group: '前台运营'
  },
  {
    key: 'devices',
    title: '设备运维',
    path: '/devices',
    icon: 'Cpu',
    permission: PERMISSION.B_DEVICE_VIEW,
    group: '设备与能耗'
  },
  {
    key: 'alarms',
    title: '告警中心',
    path: '/alarms',
    icon: 'Warning',
    permission: PERMISSION.B_ALARM_VIEW,
    group: '设备与能耗'
  },
  {
    key: 'energy',
    title: '能耗管理',
    path: '/energy',
    icon: 'Odometer',
    permission: PERMISSION.B_ENERGY_VIEW,
    group: '设备与能耗'
  },
  {
    key: 'plans',
    title: '升级方案',
    path: '/plans',
    icon: 'MagicStick',
    permission: PERMISSION.B_PLAN_VIEW,
    group: '增值服务'
  },
  {
    key: 'finance',
    title: '财务对账',
    path: '/finance',
    icon: 'Money',
    permission: PERMISSION.B_FINANCE_VIEW,
    group: '财务'
  }
])

/**
 * 判断角色是否拥有指定权限。
 * @param {string} role 角色
 * @param {string} permission 权限码
 * @returns {boolean}
 */
export function hasPermission(role, permission) {
  if (!role || !permission) return false
  const list = ROLE_PERMISSIONS[role]
  if (!list) return false
  return list.includes('*') || list.includes(permission)
}

/**
 * 获取角色可访问的 B 端菜单（保持 ADMIN_MENUS 顺序）。
 * @param {string} role 角色
 * @returns {typeof ADMIN_MENUS}
 */
export function getMenusByRole(role) {
  return ADMIN_MENUS.filter((menu) => hasPermission(role, menu.permission))
}

/**
 * 按分组聚合菜单，用于侧边栏渲染。
 * @param {string} role 角色
 * @returns {Array<{ group: string, menus: Array<{ key: string, title: string, path: string, icon: string }> }>}
 */
export function getMenuGroupsByRole(role) {
  const menus = getMenusByRole(role)
  /** @type {Array<{ group: string, menus: any[] }>} */
  const groups = []
  menus.forEach((menu) => {
    const groupName = menu.group || '其他'
    let group = groups.find((item) => item.group === groupName)
    if (!group) {
      group = { group: groupName, menus: [] }
      groups.push(group)
    }
    group.menus.push(menu)
  })
  return groups
}

/**
 * 角色是否属于 B 端。
 * @param {string} role
 * @returns {boolean}
 */
export function isStaffRole(role) {
  return role !== ROLE.CUSTOMER && Boolean(ROLE_PERMISSIONS[role])
}

/** 角色下拉选项 */
export const ROLE_OPTIONS = Object.entries(ROLE).map(([, value]) => ({
  value,
  label: ROLE_LABEL[value]
}))
