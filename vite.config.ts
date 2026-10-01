import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      "@shared": "/src/shared",
    },
  },
  build: {
    // Keep the client separate from the server bundle (dist/server) so Express only
    // ever serves client files.
    outDir: "dist/client",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/ws": { target: "ws://localhost:3000", ws: true },
      "/api": "http://localhost:3000",
    },
  },
});
