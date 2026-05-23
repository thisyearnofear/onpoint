import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    include: [
      "lib/**/*.test.{ts,tsx}",
      "middleware/**/*.test.{ts,tsx}",
      "app/**/*.test.{ts,tsx}",
      "components/**/*.test.{ts,tsx}",
    ],
    testTimeout: 15000,
    environment: "jsdom",
    globals: true,
  },
  resolve: {
    alias: {
      "@/": path.resolve(__dirname, "./"),
    },
  },
});
