<script setup>
/**
 * 错误页公共组件（403 / 404 复用）。
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@smart-home/stores'
import { resolveHomePath } from '@/utils/nav.js'

const props = defineProps({
  /** 错误码 */
  code: { type: String, default: '404' },
  /** 标题 */
  title: { type: String, default: '页面不存在' },
  /** 描述 */
  desc: { type: String, default: '' },
  /** 图标 */
  icon: { type: String, default: 'WarningFilled' }
})

const router = useRouter()
const auth = useAuthStore()

const isLoggedIn = computed(() => auth.isLoggedIn && auth.isStaff)
const homePath = computed(() => resolveHomePath(auth.role))

/**
 * 返回角色首页。
 */
function goHome() {
  router.replace(homePath.value || '/login')
}
</script>

<template>
  <div class="error-page">
    <div class="error-page__card">
      <div class="error-page__code">{{ code }}</div>
      <div class="error-page__icon">
        <el-icon :size="30"><component :is="icon" /></el-icon>
      </div>
      <h1>{{ title }}</h1>
      <p v-if="desc">{{ desc }}</p>
      <p v-else class="text-muted">你访问的页面不存在或已被移除，请检查地址是否正确。</p>

      <div class="error-page__meta" v-if="isLoggedIn">
        当前角色：<el-tag size="small" effect="plain">{{ auth.roleLabel }}</el-tag>
        <span class="text-muted">·</span>
        <span class="text-muted">{{ auth.displayName }}</span>
      </div>

      <div class="error-page__actions">
        <el-button v-if="isLoggedIn" type="primary" @click="goHome">
          <el-icon><HomeFilled /></el-icon>
          <span>返回工作台</span>
        </el-button>
        <el-button v-else type="primary" @click="router.replace('/login')">
          <el-icon><Key /></el-icon>
          <span>前往登录</span>
        </el-button>
        <el-button @click="router.back()">
          <el-icon><Back /></el-icon>
          <span>返回上一页</span>
        </el-button>
      </div>

      <p class="error-page__tips">
        <el-icon :size="12"><InfoFilled /></el-icon>
        如确认权限有误，请联系店长在权限配置中调整角色。
      </p>
    </div>
    <footer class="error-page__footer">智慧住家 · 管理后台</footer>
  </div>
</template>

<style scoped>
.error-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 20px;
  background: radial-gradient(1000px 620px at 50% -10%, #e8f1ff 0%, #f4f7fb 55%, #eef3fa 100%);
  position: relative;
  overflow: hidden;
}

.error-page::before {
  content: '';
  position: absolute;
  width: 620px;
  height: 620px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(22, 119, 255, 0.1), transparent 65%);
  top: -260px;
  right: -160px;
  pointer-events: none;
}

.error-page__card {
  position: relative;
  z-index: 1;
  width: min(520px, 100%);
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid #e6edf8;
  border-radius: 22px;
  box-shadow: 0 24px 60px rgba(31, 45, 61, 0.12);
  padding: 36px 40px 30px;
  text-align: center;
  backdrop-filter: blur(8px);
}

.error-page__code {
  font-family: var(--font-number);
  font-size: 72px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 4px;
  background: linear-gradient(120deg, #1677ff 10%, #72b0ff 70%, #b9d6ff 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.error-page__icon {
  width: 62px;
  height: 62px;
  margin: 4px auto 0;
  border-radius: 18px;
  background: linear-gradient(135deg, #1677ff, #5ba4ff);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12px 26px rgba(22, 119, 255, 0.32);
}

.error-page h1 {
  margin: 18px 0 0;
  font-size: 22px;
  color: var(--text-main);
  letter-spacing: 0.5px;
}

.error-page__card > p {
  margin: 10px 0 0;
  font-size: 13px;
  line-height: 1.75;
  color: var(--text-secondary);
}

.error-page__meta {
  margin-top: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

.error-page__actions {
  margin-top: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}

.error-page__tips {
  margin-top: 20px !important;
  padding-top: 16px;
  border-top: 1px dashed var(--border-light);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  font-size: 11.5px !important;
  color: var(--text-placeholder) !important;
}

.error-page__footer {
  position: relative;
  z-index: 1;
  margin-top: 22px;
  font-size: 11.5px;
  color: #9aa9bf;
  letter-spacing: 0.5px;
}
</style>
