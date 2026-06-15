import { describe, it, expect, vi } from "vitest";
import { withTimeout, abortableTimeout } from "@repo/ai-client";

describe("withTimeout", () => {
  it("resolves with the value when the promise resolves before the timeout", async () => {
    const result = await withTimeout(
      Promise.resolve("ok"),
      1000,
      "should not be thrown",
    );
    expect(result).toBe("ok");
  });

  it("rejects with the provided message when the promise does not resolve in time", async () => {
    const slow = new Promise((resolve) => setTimeout(() => resolve("late"), 500));
    await expect(
      withTimeout(slow, 50, "Camera setup timed out"),
    ).rejects.toThrow("Camera setup timed out");
  });

  it("propagates the original rejection if the promise rejects before the timeout", async () => {
    const failing = Promise.reject(new Error("permission denied"));
    await expect(
      withTimeout(failing, 1000, "should not be thrown"),
    ).rejects.toThrow("permission denied");
  });

  it("clears the timer once the promise resolves (no leaked timer)", async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

    await withTimeout(Promise.resolve("done"), 5000, "msg");
    expect(setTimeoutSpy).toHaveBeenCalled();
    expect(clearTimeoutSpy).toHaveBeenCalled();

    setTimeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
  });

  it("clears the timer once the promise rejects (no leaked timer)", async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

    try {
      await withTimeout(Promise.reject(new Error("bad")), 5000, "msg");
    } catch {
      // expected
    }
    expect(setTimeoutSpy).toHaveBeenCalled();
    expect(clearTimeoutSpy).toHaveBeenCalled();

    setTimeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
  });
});

describe("abortableTimeout", () => {
  it("invokes onTimeout with the pending promise when the timer wins", async () => {
    const slow = new Promise<string>((resolve) =>
      setTimeout(() => resolve("late"), 200),
    );
    const onTimeout = vi.fn();
    await expect(
      abortableTimeout(slow, 50, "timed out", onTimeout),
    ).rejects.toThrow("timed out");
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(onTimeout).toHaveBeenCalledWith(slow);
    // Wait long enough for the late resolver to fire so the test doesn't
    // leak the pending promise into the next test.
    await slow;
  });

  it("does not invoke onTimeout when the promise resolves first", async () => {
    const onTimeout = vi.fn();
    const result = await abortableTimeout(
      Promise.resolve("ok"),
      5000,
      "msg",
      onTimeout,
    );
    expect(result).toBe("ok");
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("propagates the original rejection if the promise rejects first", async () => {
    const onTimeout = vi.fn();
    await expect(
      abortableTimeout(
        Promise.reject(new Error("denied")),
        5000,
        "msg",
        onTimeout,
      ),
    ).rejects.toThrow("denied");
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
