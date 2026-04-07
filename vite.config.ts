import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  plugins: [
    react(),
    crx({ manifest }),
  ],
  server: {
    cors: {
      origin: [/chrome-extension:\/\//],
    },
  },
});