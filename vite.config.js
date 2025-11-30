import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Gestor de Tarefas',
        short_name: 'Tarefas',
        description: 'App de Gestão de Tarefas Semanal',
        theme_color: '#ffffff',
        display: 'standalone', // Isto faz parecer uma app nativa (sem barra de url)
        icons: [
          {
            src: 'pwa-192x192.png', // Nota: Idealmente deve adicionar estas imagens à pasta public
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})