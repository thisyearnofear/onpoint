import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  outDir: "dist",
  sourcemap: true,
  clean: true,
  bundle: true, // Bundle local imports into a single output file
  noExternal: [/^@0xsplits/, /^viem/, /^@onpoint/, /^ethers/], // Keep external deps as require()
});
