import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
    testTimeout: 10000,
    globals: true,
    environment: "node",
    setupFiles: [],
  },
  resolve: {
    alias: {
      "@repo/blockchain-client": path.resolve(
        __dirname,
        "../blockchain-client/src/index.ts",
      ),
      "@repo/ipfs-client": path.resolve(
        __dirname,
        "../ipfs-client/src/index.ts",
      ),
    },
  },
});
