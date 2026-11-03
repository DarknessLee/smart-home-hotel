<script setup>
/**
 * 后台主布局：左侧动态菜单 + 顶栏 + 内容区。
 * 未登录访问任意后台路由时由路由守卫重定向到 /login。
 */
import { onMounted, ref } from 'vue'
import { useAppStore, useAuthStore, useRoomStore } from '@smart-home/stores'
import AdminSidebar from '@/components/AdminSidebar.vue'
import AdminHeader from '@/components/AdminHeader.vue'

const app = useAppStore()
const auth = useAuthStore()
const roomStore = useRoomStore()
const storeName = ref('智慧住家·未来城旗舰店')

onMounted(async () => {
  app.boot()
  try {
    const stores = await roomStore.fetchStores()
    if (stores && stores.length && stores[0].name) storeName.value = stores[0].name
  } catch (error) {
    // 门店信息失败不阻断后台使用（顶栏展示兜底名称）
    console.warn('[layout] 门店信息加载失败:', error.message)
  }
})
</script>

<template>
  <div class="layout">
    <AdminSidebar :collapsed="app.sidebarCollapsed" />
    <div class="layout__main">
      <AdminHeader
        :store-name="storeName"
        :collapsed="app.sidebarCollapsed"
        @toggle="app.toggleSidebar()"
      />
      <main class="layout__content">
        <el-scrollbar>
          <div class="layout__inner">
            <router-view v-slot="{ Component }">
              <transition name="page-fade" mode="out-in">
                <component :is="Component" />
              </transition>
            </router-view>
          </div>
        </el-scrollbar>
      </main>
    </div>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: var(--page-bg);
}

.layout__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.layout__content {
  flex: 1;
  min-height: 0;
  background: var(--page-bg);
}

.layout__inner {
  padding: 20px 24px 32px;
  min-height: calc(100vh - var(--header-height));
}

.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.page-fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.page-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (max-width: 1280px) {
  .layout__inner {
    padding: 16px 16px 26px;
  }
}
</style>
