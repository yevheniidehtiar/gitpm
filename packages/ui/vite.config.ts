import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const isDemo = process.env.VITE_DEMO_MODE === '1';

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  // Use a separate publicDir for the demo build so `public/` stays empty for
  // npm-published builds and `public-demo/demo-data.json` only affects the
  // GitHub Pages demo.
  publicDir: isDemo ? 'public-demo' : 'public',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@/': new URL('./src/', import.meta.url).pathname,
    },
  },
  server: {
    proxy: {
      '/api': `http://localhost:${process.env.PORT ?? 4747}`,
    },
  },
});
