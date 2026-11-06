import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  // tsconfig uses jsx:"preserve" (Next); esbuild fixes it for vitest.
  esbuild: { jsx: "automatic" },
  test: {
    include: [
      "lib/**/*.test.{ts,tsx}",
      "middleware/**/*.test.{ts,tsx}",
      "app/**/*.test.{ts,tsx}",
      "components/**/*.test.{ts,tsx}",
      "hooks/**/*.test.{ts,tsx}",
    ],
    testTimeout: 15000,
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test-setup.ts"],
  },
  resolve: {
    alias: {
      // The key keeps its trailing slash, so the replacement needs one too —
      // without it "@/components/x" resolved to "<root>components/x".
      "@/": path.resolve(__dirname) + "/",
    },
  },
});
