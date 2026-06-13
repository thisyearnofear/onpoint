import { describe, it, expect, vi } from "vitest";
import { withTimeout } from "@repo/ai-client";

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
