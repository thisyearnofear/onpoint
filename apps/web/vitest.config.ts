import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "lib/**/*.test.ts",
      "middleware/**/*.test.ts",
      "app/**/*.test.ts",
    ],
    testTimeout: 15000,
  },
});
