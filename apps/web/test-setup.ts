/**
 * Shared vitest setup (jsdom). jsdom does not implement `File`, and the
 * vitest version in CI (3.x) does not backfill it from Node globals —
 * runway sample picking constructs `new File(...)` in the browser path.
 */
import { File as NodeFile } from "node:buffer";

if (typeof globalThis.File === "undefined") {
  (globalThis as { File?: unknown }).File = NodeFile;
}
