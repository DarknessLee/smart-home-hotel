<script setup>
/**
 * 登录页：品牌区 + 4 个角色卡片（免密登录）。
 *
 * - 已登录（且为 B 端员工）访问 /login 自动回到该角色首页；
 * - 点击角色卡片调用 authStore.staffLogin({ role })；
 * - 底部说明 Mock 演示无需密码，并提示 C 端顾客登录入口。
 */
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { DEMO_ACCOUNTS, ROLE, ROLE_LABEL } from '@smart-home/utils'
import { useAuthStore } from '@smart-home/stores'
import { resolveHomePath } from '@/utils/nav.js'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const pendingRole = ref('')

/**
 * 登录页展示的角色卡片（职责说明用于演示 RBAC 差异）。
 */
const roleCards = [
  {
    role: ROLE.STORE_MANAGER,
    label: ROLE_LABEL[ROLE.STORE_MANAGER],
    icon: 'User',
    accent: '#1677ff',
    soft: '#e8f1ff',
    tagline: '全店经营把控',
    duties: ['经营看板与财务对账', '房态 / 订单全流程', '方案生成与审批', '设备与告警总览'],
    phone: DEMO_ACCOUNTS.staff[0].phone,
    name: '王经理'
  },
  {
    role: ROLE.FRONTDESK,
    label: ROLE_LABEL[ROLE.FRONTDESK],
    icon: 'Service',
    accent: '#13c2c2',
    soft: '#e6fffb',
    tagline: '前台接待与房态',
    duties: ['房态工作台操作', '办理入住 / 退房', '订单接单与退款确认', '告警响应处理'],
    phone: DEMO_ACCOUNTS.staff[1].phone,
    name: '李前台'
  },
  {
    role: ROLE.FINANCE,
    label: ROLE_LABEL[ROLE.FINANCE],
    icon: 'Money',
    accent: '#52c41a',
    soft: '#f0fbe8',
    tagline: '财务对账与开票',
    duties: ['经营看板查看', '订单金额核对', '发票开具与对账', '权限内不含设备操作'],
    phone: DEMO_ACCOUNTS.staff[2].phone,
    name: '赵会计'
  },
  {
    role: ROLE.ENGINEER,
    label: ROLE_LABEL[ROLE.ENGINEER],
    icon: 'Tools',
    accent: '#722ed1',
    soft: '#f6eeff',
    tagline: '设备与能耗运维',
    duties: ['全局设备远程控制', '设备自检与离线恢复', '告警处理', '能耗监测与方案查看'],
    phone: DEMO_ACCOUNTS.staff[3].phone,
    name: '孙工'
  }
]

const isLoggedIn = computed(() => auth.isLoggedIn && auth.isStaff)

/**
 * 按角色免密登录并跳转到该角色首个可访问页面。
 * @param {Object} card 角色卡片
 * @returns {Promise<void>}
 */
async function loginAs(card) {
  if (pendingRole.value) return
  pendingRole.value = card.role
  try {
    await auth.staffLogin({ role: card.role })
    ElMessage.success(`欢迎回来，${auth.displayName}（${auth.roleLabel}）`)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
    const fallback = resolveHomePath(card.role)
    // 仅当重定向目标对当前角色可见时才使用，避免落入 403
    const target = redirect && auth.can(getPermissionOfPath(redirect)) ? redirect : fallback
    router.replace(target || fallback)
  } catch (error) {
    ElMessage.error(error.message || '登录失败，请稍后重试')
  } finally {
    pendingRole.value = ''
  }
}

/**
 * 粗略解析路由地址对应的权限码（用于登录回跳安全校验）。
 * @param {string} path
 * @returns {string}
 */
function getPermissionOfPath(path) {
  const map = {
    '/dashboard': 'b:dashboard:view',
    '/rooms': 'b:room:view',
    '/orders': 'b:order:view',
    '/devices': 'b:device:view',
    '/alarms': 'b:alarm:view',
    '/energy': 'b:energy:view',
    '/plans': 'b:plan:view',
    '/finance': 'b:finance:view'
  }
  return map[path] || ''
}

onMounted(() => {
  if (isLoggedIn.value) {
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
    router.replace(redirect || resolveHomePath(auth.role))
  }
})
</script>

<template>
  <div class="login">
    <div class="login__bg">
      <span class="login__orb login__orb--1" />
      <span class="login__orb login__orb--2" />
      <span class="login__orb login__orb--3" />
      <span class="login__grid" />
    </div>

    <div class="login__panel">
      <!-- 左侧品牌区 -->
      <section class="brand">
        <div class="brand__logo">智</div>
        <h1 class="brand__name">智慧住家</h1>
        <p class="brand__slogan">全链路智能家居酒店 · B 端管理后台</p>
        <p class="brand__desc">
          经营看板、50 间客房房态工作台、订单状态机、设备远程运维、告警中心、能耗分析、升级方案与财务对账，
          一套后台覆盖门店日常运营全流程。
        </p>

        <ul class="brand__features">
          <li>
            <span class="feature-icon"><el-icon><DataLine /></el-icon></span>
            <div><strong>实时经营看板</strong><small>营收 / 入住率 / ADR 趋势一屏掌握</small></div>
          </li>
          <li>
            <span class="feature-icon"><el-icon><Grid /></el-icon></span>
            <div><strong>可视化房态图</strong><small>5 种房态配色，一键入住退房保洁</small></div>
          </li>
          <li>
            <span class="feature-icon"><el-icon><Cpu /></el-icon></span>
            <div><strong>设备远程控制</strong><small>灯光 / 空调 / 窗帘 / 电视属性下发</small></div>
          </li>
        </ul>

        <p class="brand__tips">
          <el-icon :size="13"><InfoFilled /></el-icon>
          Mock 演示环境 · 数据保存在内存中，刷新页面恢复初始演示数据
        </p>
      </section>

      <!-- 右侧角色卡片 -->
      <section class="roles">
        <div class="roles__head">
          <div>
            <h2>选择演示角色</h2>
            <p>员工账号免密登录，点击卡片即可进入对应权限的后台</p>
          </div>
          <el-tag type="success" effect="light" size="small" round>Mock 模式</el-tag>
        </div>

        <div class="roles__grid">
          <button
            v-for="card in roleCards"
            :key="card.role"
            type="button"
            class="role-card"
            :class="{ 'is-loading': pendingRole === card.role }"
            :style="{ '--accent': card.accent, '--soft': card.soft }"
            :disabled="Boolean(pendingRole)"
            @click="loginAs(card)"
          >
            <div class="role-card__head">
              <span class="role-card__icon">
                <el-icon :size="20"><component :is="card.icon" /></el-icon>
              </span>
              <div class="role-card__title">
                <strong>{{ card.label }}</strong>
                <small>{{ card.tagline }}</small>
              </div>
              <el-icon v-if="pendingRole === card.role" class="is-loading role-card__loading" :size="16">
                <Loading />
              </el-icon>
              <el-icon v-else class="role-card__arrow" :size="15"><ArrowRightBold /></el-icon>
            </div>

            <ul class="role-card__duties">
              <li v-for="duty in card.duties" :key="duty">{{ duty }}</li>
            </ul>

            <div class="role-card__foot">
              <span class="role-card__demo">{{ card.name }} · {{ card.phone }}</span>
              <span class="role-card__enter">免密进入</span>
            </div>
          </button>
        </div>

        <div class="roles__notice">
          <p>
            <el-icon :size="13"><Lock /></el-icon>
            演示环境无需密码，角色切换会实时同步侧边栏菜单与操作按钮权限。
          </p>
          <p class="roles__notice-sub">
            C 端顾客请使用手机端应用：手机号 <span class="mono">13800138000</span> + 验证码
            <span class="mono">1234</span> 登录（已实名并入住 305 房）。
          </p>
        </div>
      </section>
    </div>

    <footer class="login__footer">智慧住家 · Smart Home Hotel © 2026 · MVP v0.1.0</footer>
  </div>
</template>

<style scoped>
.login {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 24px 20px;
  background: radial-gradient(1200px 720px at 12% 8%, #1b3a6b 0%, #0e1a31 46%, #0a1424 100%);
  overflow: hidden;
}

.login__bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.login__orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(2px);
  opacity: 0.5;
}

.login__orb--1 {
  width: 420px;
  height: 420px;
  left: -120px;
  top: -140px;
  background: radial-gradient(circle at 30% 30%, rgba(22, 119, 255, 0.55), rgba(22, 119, 255, 0));
}

.login__orb--2 {
  width: 520px;
  height: 520px;
  right: -160px;
  bottom: -220px;
  background: radial-gradient(circle at 60% 40%, rgba(114, 46, 209, 0.4), rgba(114, 46, 209, 0));
}

.login__orb--3 {
  width: 260px;
  height: 260px;
  right: 22%;
  top: -80px;
  background: radial-gradient(circle at 50% 50%, rgba(19, 194, 194, 0.34), rgba(19, 194, 194, 0));
}

.login__grid {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(255, 255, 255, 0.028) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.028) 1px, transparent 1px);
  background-size: 42px 42px;
  mask-image: radial-gradient(circle at 50% 30%, #000 0%, transparent 72%);
}

.login__panel {
  position: relative;
  z-index: 1;
  width: min(1180px, 100%);
  display: grid;
  grid-template-columns: minmax(340px, 0.9fr) minmax(480px, 1.1fr);
  gap: 46px;
  align-items: center;
  padding: 40px 44px;
  border-radius: 24px;
  background: rgba(15, 27, 48, 0.62);
  border: 1px solid rgba(122, 160, 214, 0.16);
  box-shadow: 0 40px 90px rgba(3, 9, 20, 0.55);
  backdrop-filter: blur(18px);
}

.brand {
  color: #dbe6f6;
  min-width: 0;
}

.brand__logo {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: linear-gradient(135deg, #1677ff, #5ba4ff);
  color: #fff;
  font-size: 28px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 14px 30px rgba(22, 119, 255, 0.45);
  margin-bottom: 20px;
}

.brand__name {
  margin: 0;
  color: #fff;
  font-size: 32px;
  letter-spacing: 3px;
  font-weight: 700;
}

.brand__slogan {
  margin: 10px 0 0;
  color: #8fb4e8;
  font-size: 13.5px;
  letter-spacing: 1px;
}

.brand__desc {
  margin: 18px 0 0;
  color: #93a6c2;
  font-size: 13px;
  line-height: 1.85;
}

.brand__features {
  list-style: none;
  margin: 24px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.brand__features li {
  display: flex;
  align-items: center;
  gap: 12px;
}

.feature-icon {
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  border-radius: 10px;
  background: rgba(22, 119, 255, 0.16);
  color: #7db4ff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.brand__features strong {
  display: block;
  color: #e6eefb;
  font-size: 13px;
  font-weight: 600;
}

.brand__features small {
  color: #7f93b3;
  font-size: 11.5px;
}

.brand__tips {
  margin: 28px 0 0;
  display: flex;
  align-items: center;
  gap: 7px;
  color: #6f86a8;
  font-size: 11.5px;
  line-height: 1.6;
}

.roles {
  background: rgba(255, 255, 255, 0.97);
  border-radius: 20px;
  padding: 26px 26px 22px;
  box-shadow: 0 22px 50px rgba(2, 10, 24, 0.35);
}

.roles__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}

.roles__head h2 {
  margin: 0;
  font-size: 20px;
  color: var(--text-main);
  letter-spacing: 0.5px;
}

.roles__head p {
  margin: 7px 0 0;
  font-size: 12.5px;
  color: var(--text-secondary);
}

.roles__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.role-card {
  text-align: left;
  border: 1px solid #e8edf6;
  background: #fbfdff;
  border-radius: 14px;
  padding: 14px 14px 12px;
  cursor: pointer;
  font-family: inherit;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease, background-color 0.2s ease;
  position: relative;
  overflow: hidden;
}

.role-card::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: var(--accent);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.role-card:hover {
  border-color: var(--accent);
  background: #fff;
  transform: translateY(-2px);
  box-shadow: 0 12px 26px rgba(31, 45, 61, 0.12);
}

.role-card:hover::before {
  opacity: 1;
}

.role-card:disabled {
  cursor: wait;
  opacity: 0.72;
  transform: none;
}

.role-card__head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.role-card__icon {
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  border-radius: 11px;
  background: var(--soft);
  color: var(--accent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 19px;
}

.role-card__title {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.role-card__title strong {
  font-size: 14.5px;
  color: var(--text-main);
  font-weight: 600;
}

.role-card__title small {
  font-size: 11px;
  color: var(--text-secondary);
}

.role-card__arrow {
  color: #b9c6d8;
}

.role-card__loading {
  color: var(--accent);
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.role-card__duties {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.role-card__duties li {
  position: relative;
  padding-left: 14px;
  font-size: 12px;
  color: var(--text-regular);
  line-height: 1.45;
}

.role-card__duties li::before {
  content: '';
  position: absolute;
  left: 2px;
  top: 6px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent);
  opacity: 0.55;
}

.role-card__foot {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed #e9eef7;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.role-card__demo {
  font-size: 10.5px;
  color: var(--text-placeholder);
  font-family: var(--font-number);
}

.role-card__enter {
  font-size: 11.5px;
  color: var(--accent);
  font-weight: 600;
}

.roles__notice {
  margin-top: 16px;
  padding: 12px 14px;
  border-radius: 10px;
  background: #f5f9ff;
  border: 1px solid #e4efff;
}

.roles__notice p {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  color: #5c7ba5;
  font-size: 11.5px;
  line-height: 1.6;
}

.roles__notice-sub {
  display: block !important;
  margin-top: 6px !important;
  color: #8a9bb5 !important;
  line-height: 1.7 !important;
}

.roles__notice .mono {
  color: var(--brand);
  font-weight: 600;
}

.login__footer {
  position: relative;
  z-index: 1;
  margin-top: 24px;
  color: #52678a;
  font-size: 11.5px;
  letter-spacing: 0.5px;
}

@media (max-width: 1080px) {
  .login__panel {
    grid-template-columns: 1fr;
    gap: 28px;
    padding: 30px;
  }

  .brand {
    text-align: center;
  }

  .brand__logo {
    margin: 0 auto 16px;
  }

  .brand__features {
    display: none;
  }
}

@media (max-width: 720px) {
  .login {
    padding: 20px 14px;
  }

  .login__panel {
    padding: 22px 18px;
  }

  .roles {
    padding: 20px 16px;
  }

  .roles__grid {
    grid-template-columns: 1fr;
  }

  .brand__name {
    font-size: 26px;
  }
}
</style>
