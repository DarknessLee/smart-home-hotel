/**
 * C 端（uni-app + Vue3 + Vite）构建配置。
 *
 * H5：`pnpm --filter @smart-home/customer build:h5` → 产物 dist/build/h5
 * 小程序 / App：uni-app 官方脚本自动切换平台，页面代码零改动。
 */
import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

export default defineConfig({
  plugins: [uni()],
  server: {
    port: 5173,
    host: '0.0.0.0'
  }
})
