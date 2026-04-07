import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config'

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../"),
      "@server": path.resolve(__dirname, "../server/src"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  plugins: [react(), crx({ manifest })],
})
