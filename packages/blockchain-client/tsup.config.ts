import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  outDir: "dist",
  sourcemap: true,
  clean: true,
  bundle: false, // Don't bundle — let Node resolve deps at runtime
  noExternal: [], // Bundle nothing as external
});
