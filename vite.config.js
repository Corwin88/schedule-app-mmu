import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Расписание ММУ',
        short_name: 'Расписание',
        description: 'Расписание занятий для студентов',
        theme_color: '#000000',
        background_color: '#D3D7D8',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
            ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,jpg,svg}']
      }
    })
  ]
})