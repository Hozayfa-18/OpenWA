import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  appType: 'spa', // Enable SPA fallback for client-side routing
  // Load env from the backend folder (openwa/) so all config lives in openwa/.env.
  // Only VITE_-prefixed vars are exposed to the client bundle; secrets in the same
  // file (CLERK_SECRET_KEY, DB, S3) are never shipped to the browser.
  envDir: '..',
  define: {
    __APP_VERSION__: JSON.stringify(process.env.APP_VERSION || '0.2.1'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    port: 2886,
    proxy: {
      '/api': {
        target: 'http://localhost:2785',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
