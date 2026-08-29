import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:8787';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5273,
    proxy: { '/api': { target: BACKEND, changeOrigin: true } },
  },
  build: { outDir: 'dist' },
});
