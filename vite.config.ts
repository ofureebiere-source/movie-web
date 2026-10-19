import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

const API_ORIGIN = 'https://api.framextv.tech';

/**
 * The anime API answers with a CORS origin allowlist rather than `*`, so it is
 * only reachable same-origin. Production proxies `/anime/api` through
 * `vercel.json`; the dev and preview servers need the same rule or anime reads
 * fail with "Failed to fetch" while every other endpoint works.
 *
 * The key is `/anime/api`, not `/anime`: a broader prefix would also swallow
 * the app's own `/anime/:id` detail route and serve JSON where a page belongs.
 */
const animeProxy = {
  '/anime/api': {
    target: API_ORIGIN,
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    // The player bundle is large (hls.js + controls); a chunk warning at the
    // default 500 kB is noise here, so raise the ceiling.
    chunkSizeWarningLimit: 1200,
  },
  server: {
    port: 5173,
    // The sandbox reaches the dev/preview server through a generated
    // *.prod-runtime.all-hands.dev hostname, which Vite rejects by default.
    allowedHosts: true,
    proxy: animeProxy,
  },
  preview: {
    port: 12000,
    allowedHosts: true,
    proxy: animeProxy,
  },
});
