import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  dts: false,
  sourcemap: true,
  clean: true,
  external: ["@repo/agent-core", "viem"],
  tsconfig: "tsconfig.json",
  target: "node20",
});
