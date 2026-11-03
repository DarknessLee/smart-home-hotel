<script setup>
/**
 * 顶栏：折叠按钮、面包屑、门店名、Mock 标识、当前角色、角色切换、退出登录。
 *
 * 角色切换用于演示 RBAC：调用 authStore.staffLogin({ role }) 免密切换，
 * 切换后若当前路由对新角色无权限，则回到该角色的首个可访问页面。
 */
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ROLE_LABEL } from '@smart-home/utils'
import { useAppStore, useAuthStore } from '@smart-home/stores'
import { STAFF_ROLE_OPTIONS, resolveHomePath } from '@/utils/nav.js'

defineProps({
  /** 当前门店名称 */
  storeName: { type: String, default: '智慧住家·未来城旗舰店' },
  /** 侧边栏是否折叠 */
  collapsed: { type: Boolean, default: false }
})

const emit = defineEmits(['toggle'])

const route = useRoute()
const router = useRouter()
const app = useAppStore()
const auth = useAuthStore()
const switching = ref(false)

/** 面包屑：所属分组 / 当前页面 */
const breadcrumbs = computed(() => {
  const items = []
  if (route.meta && route.meta.group) items.push({ label: route.meta.group, path: '' })
  items.push({ label: (route.meta && route.meta.title) || '管理后台', path: route.path })
  return items
})

/** 当前角色是否可切换（未登录不可） */
const canSwitchRole = computed(() => auth.isLoggedIn)

/**
 * 切换演示角色。
 * @param {string} role 目标角色
 * @returns {Promise<void>}
 */
async function handleRoleCommand(role) {
  if (!role || role === auth.role || switching.value) return
  switching.value = true
  try {
    await auth.staffLogin({ role })
    ElMessage.success(`已切换为「${ROLE_LABEL[role] || role}」，菜单与操作权限同步更新`)
    const permission = route.meta && route.meta.permission
    if (permission && !auth.can(permission)) {
      router.replace(resolveHomePath(role))
    }
  } catch (error) {
    ElMessage.error(error.message || '角色切换失败，请重试')
  } finally {
    switching.value = false
  }
}

/**
 * 退出登录。
 * @returns {Promise<void>}
 */
async function handleLogout() {
  try {
    await ElMessageBox.confirm('退出后需要重新选择角色登录，确定退出吗？', '退出登录', {
      confirmButtonText: '退出',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch (error) {
    return
  }
  await auth.logout()
  ElMessage.success('已退出登录')
  router.replace('/login')
}
</script>

<template>
  <header class="topbar">
    <div class="topbar__left">
      <button class="icon-btn" type="button" :title="collapsed ? '展开菜单' : '收起菜单'" @click="emit('toggle')">
        <el-icon :size="18">
          <Expand v-if="collapsed" />
          <Fold v-else />
        </el-icon>
      </button>

      <div class="topbar__crumb">
        <router-link :to="resolveHomePath(auth.role)" class="crumb-home">
          <el-icon :size="14"><HomeFilled /></el-icon>
          <span>首页</span>
        </router-link>
        <template v-for="(item, index) in breadcrumbs" :key="`${item.label}-${index}`">
          <el-icon class="crumb-sep" :size="12"><ArrowRight /></el-icon>
          <span class="crumb-item" :class="{ 'is-current': index === breadcrumbs.length - 1 }">{{ item.label }}</span>
        </template>
      </div>
    </div>

    <div class="topbar__right">
      <div class="store-chip" :title="storeName">
        <el-icon :size="15"><OfficeBuilding /></el-icon>
        <span>{{ storeName }}</span>
      </div>

      <el-tag v-if="app.mockMode" type="success" effect="light" size="small" class="mock-tag" round>
        <span class="mock-dot" />Mock 模式
      </el-tag>

      <el-dropdown v-if="canSwitchRole" trigger="click" :disabled="switching" @command="handleRoleCommand">
        <span class="role-switch">
          <el-tag type="primary" effect="plain" size="small" round>{{ auth.roleLabel }}</el-tag>
          <el-icon :size="12" class="role-caret"><CaretBottom /></el-icon>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item disabled class="role-menu-tip">切换演示角色（免密，Mock）</el-dropdown-item>
            <el-dropdown-item
              v-for="role in STAFF_ROLE_OPTIONS"
              :key="role.value"
              :command="role.value"
              :disabled="role.value === auth.role"
            >
              <span class="role-menu-item">
                <span>{{ role.label }}</span>
                <el-icon v-if="role.value === auth.role" :size="14" class="role-menu-check"><Check /></el-icon>
              </span>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <span class="topbar__divider" />

      <el-dropdown trigger="click">
        <span class="user-chip">
          <span class="user-avatar">{{ (auth.displayName || '客').slice(0, 1) }}</span>
          <span class="user-meta">
            <strong>{{ auth.displayName }}</strong>
            <small>{{ auth.roleLabel }}</small>
          </span>
          <el-icon :size="12" class="user-caret"><CaretBottom /></el-icon>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item disabled>
              <span class="text-muted">员工账号</span>
            </el-dropdown-item>
            <el-dropdown-item disabled>
              <span class="mono">{{ auth.user && auth.user.phone }}</span>
            </el-dropdown-item>
            <el-dropdown-item divided @click="handleLogout">
              <el-icon><SwitchButton /></el-icon>
              <span>退出登录</span>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <el-button class="logout-btn" text type="danger" size="small" :disabled="switching" @click="handleLogout">
        <el-icon><SwitchButton /></el-icon>
        <span class="logout-text">退出</span>
      </el-button>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  height: var(--header-height);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 22px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border-light);
  position: relative;
  z-index: 10;
}

.topbar__left {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}

.icon-btn {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  border: 1px solid var(--border-base);
  background: #fff;
  color: var(--text-regular);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.icon-btn:hover {
  color: var(--brand);
  border-color: #bdd8ff;
  background: var(--brand-soft);
}

.topbar__crumb {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  color: var(--text-secondary);
  min-width: 0;
  overflow: hidden;
}

.crumb-home {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--text-secondary);
  transition: color 0.2s ease;
  white-space: nowrap;
}

.crumb-home:hover {
  color: var(--brand);
}

.crumb-sep {
  color: #c3cdda;
}

.crumb-item {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.crumb-item.is-current {
  color: var(--text-main);
  font-weight: 600;
}

.topbar__right {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
}

.store-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 6px 12px;
  border-radius: 9px;
  background: #f3f7fd;
  color: var(--text-regular);
  font-size: 12.5px;
  max-width: 240px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.store-chip .el-icon {
  color: var(--brand);
  flex-shrink: 0;
}

.mock-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-weight: 500;
}

.mock-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #52c41a;
  box-shadow: 0 0 0 3px rgba(82, 196, 26, 0.16);
  display: inline-block;
}

.role-switch {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  outline: none;
}

.role-caret {
  color: var(--text-secondary);
}

.role-menu-tip {
  font-size: 11.5px;
  color: var(--text-placeholder) !important;
}

.role-menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  min-width: 92px;
}

.role-menu-check {
  color: var(--brand);
}

.topbar__divider {
  width: 1px;
  height: 22px;
  background: var(--border-base);
}

.user-chip {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 10px;
  transition: background-color 0.2s ease;
  outline: none;
}

.user-chip:hover {
  background: #f3f7fd;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: linear-gradient(135deg, #1677ff, #66a6ff);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 10px rgba(22, 119, 255, 0.28);
}

.user-meta {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
  gap: 2px;
}

.user-meta strong {
  font-size: 12.5px;
  color: var(--text-main);
  font-weight: 600;
}

.user-meta small {
  font-size: 10.5px;
  color: var(--text-secondary);
}

.user-caret {
  color: var(--text-placeholder);
}

.logout-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

@media (max-width: 1440px) {
  .store-chip {
    max-width: 180px;
  }
  .user-meta {
    display: none;
  }
}

@media (max-width: 1200px) {
  .store-chip {
    display: none;
  }
  .logout-text {
    display: none;
  }
}
</style>
