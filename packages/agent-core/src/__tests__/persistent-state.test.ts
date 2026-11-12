import { afterEach, describe, expect, it } from "vitest";
import {
  clearPersistentStateCache,
  readPersistentState,
  setPersistentStateBackend,
  writePersistentState,
} from "../persistent-state";

function memoryBackend() {
  const data = new Map<string, string>();
  let failing = false;
  return {
    data,
    fail(on: boolean) {
      failing = on;
    },
    backend: {
      async get(key: string) {
        if (failing) throw new Error("redis down");
        return data.has(key) ? (data.get(key) as string) : null;
      },
      async set(key: string, value: string) {
        if (failing) throw new Error("redis down");
        data.set(key, value);
      },
    },
  };
}

afterEach(() => {
  setPersistentStateBackend(null);
  clearPersistentStateCache();
});

describe("persistent state with a backend", () => {
  it("survives a process restart (cache cleared)", async () => {
    const store = memoryBackend();
    setPersistentStateBackend(store.backend);
    await writePersistentState("receipts", [{ id: "r1" }]);

    clearPersistentStateCache();

    expect(await readPersistentState("receipts", () => [])).toEqual([{ id: "r1" }]);
  });

  it("returns the fallback only when the key truly does not exist", async () => {
    const store = memoryBackend();
    setPersistentStateBackend(store.backend);
    expect(await readPersistentState("missing", () => ["fallback"])).toEqual(["fallback"]);
  });

  it("refuses to treat a failed read as an empty store", async () => {
    const store = memoryBackend();
    setPersistentStateBackend(store.backend);
    await writePersistentState("receipts", [{ id: "r1" }]);
    clearPersistentStateCache();
    store.fail(true);

    await expect(readPersistentState("receipts", () => [])).rejects.toThrow(
      /Persistent state unavailable/,
    );

    store.fail(false);
    expect(JSON.parse(store.data.get("receipts") as string)).toEqual([{ id: "r1" }]);
  });

  it("serves the last value this process saw when a read fails", async () => {
    const store = memoryBackend();
    setPersistentStateBackend(store.backend);
    await writePersistentState("receipts", [{ id: "r1" }]);
    store.fail(true);

    expect(await readPersistentState("receipts", () => [])).toEqual([{ id: "r1" }]);
  });

  it("rejects a write that did not reach the store", async () => {
    const store = memoryBackend();
    setPersistentStateBackend(store.backend);
    store.fail(true);
    await expect(writePersistentState("receipts", [{ id: "r2" }])).rejects.toThrow("redis down");
  });
});
