/**
 * B 端管理后台入口：
 * 1. 初始化统一请求层（Mock 开关由 .env 控制）；
 * 2. 注册 Element Plus、全部图标、Pinia、Vue Router；
 * 3. 401 统一清理会话并跳转登录页。
 */
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import 'element-plus/dist/index.css'
import { clearToken, initHttp } from '@smart-home/api'
import { removeStorage } from '@smart-home/utils'
import App from './App.vue'
import router from './router/index.js'
import './styles/index.css'

initHttp({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  mock: import.meta.env.VITE_USE_MOCK !== 'false',
  /**
   * 登录失效统一处理：清理本地会话并跳转登录页（避免真实接口 401 时页面白屏）。
   */
  onUnauthorized: () => {
    clearToken()
    removeStorage('user')
    const current = router.currentRoute.value
    if (current.path !== '/login') {
      router.replace({ path: '/login', query: { redirect: current.fullPath } })
    }
  }
})

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)

// Element Plus 全量图标全局注册，模板中可直接 <el-icon><DataLine /></el-icon>
Object.entries(ElementPlusIconsVue).forEach(([name, component]) => {
  app.component(name, component)
})

app.use(ElementPlus, { locale: zhCn, zIndex: 3000 })
app.use(router)

app.config.errorHandler = (error, instance, info) => {
  // 统一兜底，便于演示时定位组件异常
  console.error('[admin] runtime error:', info, error)
}

app.mount('#app')
