import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  outDir: "dist",
  sourcemap: true,
  clean: true,
  // Bundle local imports (./oss.js) into the output. External deps
  // (ali-oss) are left as require() so they resolve from node_modules.
  bundle: true,
  noExternal: [],
});
