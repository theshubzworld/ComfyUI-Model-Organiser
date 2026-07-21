import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 3000,
    strictPort: true,
    open: true,

    // In dev, proxy /api/* to local Python server on port 3001
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },

    watch: {
      // Exclude runtime-written files from triggering HMR reloads
      ignored: [
        '**/.env',
        '**/.env.local',
        '**/data/master-model-list.txt',
        '**/data/civitai_download.txt',
        '**/data/model_cache.json',
        '**/*.log',
        '**/*.py',
      ]
    }
  }
})
