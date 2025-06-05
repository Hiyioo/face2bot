import path, { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import copy from 'rollup-plugin-copy'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    copy({
      targets: [
        {
          src: resolve(__dirname, 'node_modules/@mediapipe/tasks-vision/wasm'),
          dest: resolve(__dirname, 'public/mediapipe'),
        },
      ],
      hook: 'buildStart',
    }),
    UnoCSS(),
    AutoImport({
      imports: [
        'vue',
        'vue-router',
      ],
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
