import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api/identity': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (p: string) => p.replace(/^\/api\/identity/, '')
      },
      '/api/gateway': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (p: string) => p.replace(/^\/api\/gateway/, '')
      },
      '/api/privacy': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        rewrite: (p: string) => p.replace(/^\/api\/privacy/, '')
      },
      '/api/policy': {
        target: 'http://localhost:3003',
        changeOrigin: true,
        rewrite: (p: string) => p.replace(/^\/api\/policy/, '')
      },
      '/api/model': {
        target: 'http://localhost:3004',
        changeOrigin: true,
        rewrite: (p: string) => p.replace(/^\/api\/model/, '')
      },
      '/api/audit': {
        target: 'http://localhost:3005',
        changeOrigin: true,
        rewrite: (p: string) => p.replace(/^\/api\/audit/, '')
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts']
  }
} as any);
