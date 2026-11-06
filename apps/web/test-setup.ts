/**
 * Shared vitest setup (jsdom). jsdom does not implement `File`, and the
 * vitest version in CI (3.x) does not backfill it from Node globals —
 * runway sample picking constructs `new File(...)` in the browser path.
 *
 * Node 26 ships a native `localStorage` that stays undefined unless Node is
 * started with `--localstorage-file` — it shadows jsdom's Storage and leaves
 * `localStorage` undefined in tests. Shim an in-memory Storage so tests get
 * the real browser contract regardless.
 */
import { File as NodeFile } from "node:buffer";

if (typeof globalThis.File === "undefined") {
  (globalThis as { File?: unknown }).File = NodeFile;
}

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number) {
    return [...this.store.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
}

if (
  typeof globalThis.localStorage === "undefined" ||
  globalThis.localStorage == null
) {
  // Expose the shim as `Storage` so `vi.spyOn(Storage.prototype, "setItem")`
  // still intercepts writes — a real Storage constructor isn't available here.
  (globalThis as { Storage?: unknown }).Storage = MemoryStorage;
  const storage = new MemoryStorage();
  for (const name of ["localStorage", "sessionStorage"] as const) {
    try {
      Object.defineProperty(globalThis, name, {
        value: name === "sessionStorage" ? new MemoryStorage() : storage,
        configurable: true,
        writable: true,
      });
    } catch {
      // property non-configurable in this environment — leave as-is
    }
  }
}
