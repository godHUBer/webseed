import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    hmr: { clientPort: 443 },
    cors: true,
    headers: {
      'X-Frame-Options': 'ALLOWALL'
    },
    allowedHosts: true
  },
  // allow e2b preview host
  preview: {
    host: '0.0.0.0',
    port: 4173,
    cors: true,
    headers: {
      'X-Frame-Options': 'ALLOWALL'
    },
    allowedHosts: true
  },
  // vite 5 checks host via `server.allowedHosts` — we inject via define
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        webseed: 'webseed.html'
      }
    }
  }
});
