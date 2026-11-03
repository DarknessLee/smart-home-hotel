/**
 * B 端路由表。
 *
 * - 路由懒加载；
 * - `meta.permission` 与 shared-utils 的权限码一一对应，守卫统一校验；
 * - `meta.menuKey` 与 ADMIN_MENUS 的 key 对齐，侧边栏高亮据此计算。
 */
import { createRouter, createWebHistory } from 'vue-router'
import { PERMISSION } from '@smart-home/utils'

const AdminLayout = () => import('@/layouts/AdminLayout.vue')

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { title: '登录', public: true }
  },
  {
    path: '/',
    component: AdminLayout,
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/views/DashboardView.vue'),
        meta: {
          title: '经营看板',
          group: '经营分析',
          icon: 'DataLine',
          menuKey: 'dashboard',
          permission: PERMISSION.B_DASHBOARD_VIEW
        }
      },
      {
        path: 'rooms',
        name: 'rooms',
        component: () => import('@/views/RoomsView.vue'),
        meta: {
          title: '房态工作台',
          group: '前台运营',
          icon: 'Grid',
          menuKey: 'rooms',
          permission: PERMISSION.B_ROOM_VIEW
        }
      },
      {
        path: 'orders',
        name: 'orders',
        component: () => import('@/views/OrdersView.vue'),
        meta: {
          title: '订单管理',
          group: '前台运营',
          icon: 'Tickets',
          menuKey: 'orders',
          permission: PERMISSION.B_ORDER_VIEW
        }
      },
      {
        path: 'devices',
        name: 'devices',
        component: () => import('@/views/DevicesView.vue'),
        meta: {
          title: '设备运维',
          group: '设备与能耗',
          icon: 'Cpu',
          menuKey: 'devices',
          permission: PERMISSION.B_DEVICE_VIEW
        }
      },
      {
        path: 'alarms',
        name: 'alarms',
        component: () => import('@/views/AlarmsView.vue'),
        meta: {
          title: '告警中心',
          group: '设备与能耗',
          icon: 'Warning',
          menuKey: 'alarms',
          permission: PERMISSION.B_ALARM_VIEW
        }
      },
      {
        path: 'energy',
        name: 'energy',
        component: () => import('@/views/EnergyView.vue'),
        meta: {
          title: '能耗管理',
          group: '设备与能耗',
          icon: 'Odometer',
          menuKey: 'energy',
          permission: PERMISSION.B_ENERGY_VIEW
        }
      },
      {
        path: 'plans',
        name: 'plans',
        component: () => import('@/views/PlansView.vue'),
        meta: {
          title: '升级方案',
          group: '增值服务',
          icon: 'MagicStick',
          menuKey: 'plans',
          permission: PERMISSION.B_PLAN_VIEW
        }
      },
      {
        path: 'finance',
        name: 'finance',
        component: () => import('@/views/FinanceView.vue'),
        meta: {
          title: '财务对账',
          group: '财务',
          icon: 'Money',
          menuKey: 'finance',
          permission: PERMISSION.B_FINANCE_VIEW
        }
      }
    ]
  },
  {
    path: '/403',
    name: 'forbidden',
    component: () => import('@/views/ForbiddenView.vue'),
    meta: { title: '无访问权限', public: true }
  },
  {
    path: '/404',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: '页面不存在', public: true }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/404'
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL || '/'),
  routes,
  scrollBehavior() {
    return { top: 0 }
  }
})

const BASE_TITLE = '智慧住家 · 管理后台'

/**
 * 全局守卫：
 * 1. 公开页（登录 / 403 / 404）放行，已登录访问登录页自动回首页；
 * 2. 未登录访问后台页 → /login?redirect=...；
 * 3. 非员工角色（如 C 端顾客会话）→ /403；
 * 4. meta.permission 不满足 → /403。
 */
router.beforeEach(async (to) => {
  const { useAuthStore } = await import('@smart-home/stores')
  const auth = useAuthStore()

  if (to.meta.public) {
    if (to.name === 'login' && auth.isLoggedIn) {
      const { resolveHomePath } = await import('@/utils/nav.js')
      return resolveHomePath(auth.role)
    }
    return true
  }

  if (!auth.isLoggedIn) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  if (!auth.isStaff) {
    return { path: '/403', query: { from: to.fullPath } }
  }

  if (to.meta.permission && !auth.can(to.meta.permission)) {
    return { path: '/403', query: { from: to.fullPath } }
  }

  return true
})

router.afterEach((to) => {
  document.title = to.meta && to.meta.title ? `${to.meta.title} · ${BASE_TITLE}` : BASE_TITLE
})

export default router
