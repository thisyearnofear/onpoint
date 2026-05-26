import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  dts: false,
  sourcemap: true,
  clean: true,
  // All deps are bundled — shared-types has no external runtime dependencies
  noExternal: [/.*/],
  tsconfig: "tsconfig.json",
  target: "node20",
});
