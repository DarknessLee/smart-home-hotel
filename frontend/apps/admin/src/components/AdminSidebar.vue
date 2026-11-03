<script setup>
/**
 * 左侧导航：菜单完全由 `getMenuGroupsByRole(authStore.role)` 动态生成，
 * 保证越权菜单不会出现（店长全量 / 前台 / 财务 / 运维各不同）。
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { getMenuGroupsByRole } from '@smart-home/utils'
import { useAuthStore } from '@smart-home/stores'

defineProps({
  /** 是否折叠 */
  collapsed: { type: Boolean, default: false }
})

const route = useRoute()
const auth = useAuthStore()
const menuGroups = computed(() => getMenuGroupsByRole(auth.role))

/**
 * 菜单是否处于激活态（兼容未来子路由）。
 * @param {string} path
 * @returns {boolean}
 */
function isActive(path) {
  return route.path === path
}
</script>

<template>
  <aside class="sidebar" :class="{ 'is-collapsed': collapsed }">
    <div class="sidebar__brand">
      <div class="sidebar__logo">智</div>
      <div v-if="!collapsed" class="sidebar__brand-text">
        <strong>智慧住家</strong>
        <span>SMART HOME · ADMIN</span>
      </div>
    </div>

    <el-scrollbar class="sidebar__scroll">
      <nav class="sidebar__nav">
        <div v-for="group in menuGroups" :key="group.group" class="sidebar__group">
          <p v-if="!collapsed" class="sidebar__group-title">{{ group.group }}</p>
          <div v-else class="sidebar__group-divider" />
          <router-link
            v-for="menu in group.menus"
            :key="menu.key"
            :to="menu.path"
            class="sidebar__link"
            :class="{ 'is-active': isActive(menu.path) }"
            :title="collapsed ? menu.title : ''"
          >
            <el-icon class="sidebar__icon" :size="17">
              <component :is="menu.icon" />
            </el-icon>
            <span v-if="!collapsed" class="sidebar__label">{{ menu.title }}</span>
            <span class="sidebar__active-bar" />
          </router-link>
        </div>
      </nav>
    </el-scrollbar>

    <div class="sidebar__footer">
      <template v-if="!collapsed">
        <div class="sidebar__role">
          <el-icon :size="14"><UserFilled /></el-icon>
          <span>{{ auth.roleLabel }}</span>
        </div>
        <p>Mock 演示 · v0.1.0</p>
      </template>
      <el-icon v-else :size="18" class="sidebar__footer-icon"><UserFilled /></el-icon>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  flex: 0 0 var(--sidebar-width);
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #0e1a31 0%, #13223d 58%, #0f1c34 100%);
  color: #cdd8ea;
  transition: width 0.24s ease, flex-basis 0.24s ease;
  position: relative;
  z-index: 20;
  box-shadow: 4px 0 18px rgba(9, 17, 32, 0.18);
  overflow: hidden;
}

.sidebar.is-collapsed {
  width: var(--sidebar-collapsed-width);
  flex-basis: var(--sidebar-collapsed-width);
}

.sidebar__brand {
  height: var(--header-height);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.sidebar__logo {
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  border-radius: 11px;
  background: linear-gradient(135deg, #1677ff, #57a1ff);
  color: #fff;
  font-size: 19px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 16px rgba(22, 119, 255, 0.45);
}

.sidebar__brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
  overflow: hidden;
}

.sidebar__brand-text strong {
  color: #ffffff;
  font-size: 16px;
  letter-spacing: 1px;
  white-space: nowrap;
}

.sidebar__brand-text span {
  color: #6f87ad;
  font-size: 9.5px;
  letter-spacing: 1.2px;
  white-space: nowrap;
}

.sidebar__scroll {
  flex: 1;
  min-height: 0;
}

.sidebar__nav {
  padding: 14px 12px 20px;
}

.sidebar__group + .sidebar__group {
  margin-top: 14px;
}

.sidebar__group-title {
  margin: 0 0 6px;
  padding: 0 12px;
  font-size: 11px;
  letter-spacing: 1.6px;
  color: #5c7395;
  font-weight: 600;
  white-space: nowrap;
}

.sidebar__group-divider {
  height: 1px;
  margin: 8px 10px 12px;
  background: rgba(255, 255, 255, 0.07);
}

.sidebar__link {
  position: relative;
  display: flex;
  align-items: center;
  gap: 11px;
  height: 42px;
  padding: 0 13px;
  margin-bottom: 4px;
  border-radius: 10px;
  color: #b6c5dc;
  font-size: 13.5px;
  transition: background-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
  white-space: nowrap;
}

.sidebar.is-collapsed .sidebar__link {
  justify-content: center;
  padding: 0;
}

.sidebar__link:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #ffffff;
}

.sidebar__link.is-active {
  background: linear-gradient(90deg, rgba(22, 119, 255, 0.26), rgba(22, 119, 255, 0.1));
  color: #ffffff;
  box-shadow: inset 0 0 0 1px rgba(88, 158, 255, 0.24);
}

.sidebar__link.is-active .sidebar__icon {
  color: #7db4ff;
}

.sidebar__icon {
  flex-shrink: 0;
  transition: color 0.2s ease;
}

.sidebar__label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar__active-bar {
  position: absolute;
  right: 10px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #4f9bff;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.sidebar__link.is-active .sidebar__active-bar {
  opacity: 1;
}

.sidebar.is-collapsed .sidebar__active-bar {
  right: 6px;
}

.sidebar__footer {
  flex-shrink: 0;
  padding: 14px 18px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 11px;
  color: #5c7395;
}

.sidebar__footer p {
  margin: 6px 0 0;
  letter-spacing: 0.5px;
}

.sidebar.is-collapsed .sidebar__footer {
  padding: 14px 0;
}

.sidebar__role {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 20px;
  background: rgba(22, 119, 255, 0.16);
  color: #8dbdff;
  font-size: 11.5px;
}

.sidebar__footer-icon {
  color: #5c7395;
  display: block;
  margin: 0 auto;
}
</style>
