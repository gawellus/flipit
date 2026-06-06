import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "astro:env/server": path.resolve(__dirname, "./src/test/mocks/astro-env-server.ts"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
