import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';

import manifest from './src/config/manifest.config.ts';

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  build: {
    outDir: 'dist',
  },
});