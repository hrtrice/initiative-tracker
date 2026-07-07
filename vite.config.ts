import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      "@shared": "/src/shared",
    },
  },
  server: {
    proxy: {
      "/ws": "ws://localhost:3000",
      "/api": "http://localhost:3000",
    },
  },
});
