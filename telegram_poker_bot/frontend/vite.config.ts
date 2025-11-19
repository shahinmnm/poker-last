import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const allowedHosts = (env.VITE_ALLOWED_HOSTS || 'poker.shahin8n.sbs')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean)

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3000,
      host: true,
      allowedHosts: allowedHosts.length > 0 ? allowedHosts : undefined,
    },
    preview: {
      allowedHosts: allowedHosts.length > 0 ? allowedHosts : undefined,
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  }
})
