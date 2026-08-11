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
      // Lets external testers reach the dev server through an ngrok tunnel -
      // Vite 5+ rejects requests whose Host header it doesn't recognize by
      // default (DNS rebinding protection), which blocks any *.ngrok-free.app
      // hostname outright.
      allowedHosts: ['.ngrok-free.app', '.ngrok.app'],
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
              // The tunnel target is an ngrok free-tier domain: ngrok serves an
              // HTML interstitial warning page instead of proxying through
              // whenever a request's User-Agent looks like a browser (curl is
              // unaffected, which is why this only broke real usage). This
              // header opts out of that interstitial.
              headers: { 'ngrok-skip-browser-warning': 'true' },
            },
          }
        : undefined,
    },
  }
})
