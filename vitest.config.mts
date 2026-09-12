import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    fileParallelism: false,
    globalSetup: ["./tests/infra/global-setup.ts"],
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/infra/setup.ts"],
    testTimeout: 15_000,
  },
});
