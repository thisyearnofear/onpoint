import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/migrate.ts"],
  format: ["cjs"],
  outDir: "dist",
  sourcemap: true,
  clean: true,
  bundle: true,
  noExternal: [],
});
