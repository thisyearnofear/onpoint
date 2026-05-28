import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  // Skip DTS — the base tsconfig uses NodeNext module resolution
  // which requires .js extensions in ESM imports. The source files
  // use bare import paths for compatibility with the web app (Next.js
  // resolves these fine). DTS is not needed for the Express API server.
  dts: false,
  sourcemap: true,
  clean: true,
  // Bundle all workspace deps so the CJS consumer (Express API) doesn't
  // need to resolve @repo/blockchain-client, @repo/ipfs-client, etc.
  // Peer deps (WDK, OWS) are optional and loaded dynamically.
  noExternal: [
    "@repo/blockchain-client",
    "@repo/ipfs-client",
  ],
  external: [
    "viem",
    "@upstash/redis",
    "@lighthouse-web3/sdk",
    "@lighthouse-web3/kavach",
    "bls-eth-wasm",
  ],
  tsconfig: "tsconfig.json",
  target: "node20",
});
