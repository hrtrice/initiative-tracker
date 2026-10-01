import { defineConfig, type Plugin } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

/**
 * Identifies this build. It's baked into the client bundle (__BUILD_ID__) and published
 * as /version.json, so a page left open across a deploy can notice and reload itself.
 */
const buildId = process.env.BUILD_ID || new Date().toISOString();

function versionFile(): Plugin {
  return {
    name: "version-file",
    apply: "build",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ buildId }) });
    },
  };
}

export default defineConfig({
  plugins: [svelte(), versionFile()],
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
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
