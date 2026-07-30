import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      proxy: env.VITE_EXT_PROXY_URL
        ? {
            // The real FCC extension proxy (fce-veil-bid's ext-proxy) doesn't
            // send CORS headers, so a direct browser fetch is blocked. This
            // dev-only proxy makes requests same-origin during `npm run dev`.
            // A production deployment would need an equivalent server-side
            // proxy (or CORS support added upstream) since Vite's dev proxy
            // doesn't exist in a static build.
            '/tee-proxy': {
              target: env.VITE_EXT_PROXY_URL,
              changeOrigin: true,
              rewrite: (path) => path.replace(/^\/tee-proxy/, ''),
            },
          }
        : undefined,
    },
  }
})
