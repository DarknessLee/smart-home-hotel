/**
 * B 端管理后台 Vite 配置。
 *
 * - 端口 5174（与 C 端 5173 区分）；
 * - alias `@` → src，页面统一使用绝对路径引入；
 * - /api 代理仅在关闭 Mock（VITE_USE_MOCK=false）对接真实后端时生效。
 */
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5174,
    host: true,
    open: false,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1600
  }
})
