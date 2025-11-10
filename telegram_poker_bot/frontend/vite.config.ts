import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const DEFAULT_ALLOWED_HOSTS = [
    'poker.shahin8n.sbs',
    'localhost',
    '127.0.0.1',
    '::1',
  ]

  const allowedHostsFromEnv = (env.VITE_ALLOWED_HOSTS || '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean)

  const allowedHosts = Array.from(
    new Set(
      allowedHostsFromEnv.length > 0
        ? [...allowedHostsFromEnv, ...DEFAULT_ALLOWED_HOSTS]
        : DEFAULT_ALLOWED_HOSTS,
    ),
  )

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
