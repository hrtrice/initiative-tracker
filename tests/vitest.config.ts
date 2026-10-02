import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify("test-build"),
  },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../src/shared"),
    },
  },
});
