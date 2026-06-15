import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withTimeout, abortableTimeout, getUserMediaWithTimeout } from "@repo/ai-client";

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

describe("getUserMediaWithTimeout", () => {
  type StopFn = () => void;
  type Track = { stop: () => void };
  type MockStream = { getTracks: () => Track[] };

  let originalGetUserMedia: typeof navigator.mediaDevices.getUserMedia;
  let originalMediaDevices: MediaDevices | undefined;

  beforeEach(() => {
    originalMediaDevices = navigator.mediaDevices;
  });

  afterEach(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: originalMediaDevices,
      configurable: true,
      writable: true,
    });
  });

  function installMockGetUserMedia(
    impl: (constraints: MediaStreamConstraints) => Promise<MockStream>,
  ) {
    const fakeMediaDevices = {
      getUserMedia: vi.fn(impl),
    } as unknown as MediaDevices;
    Object.defineProperty(navigator, "mediaDevices", {
      value: fakeMediaDevices,
      configurable: true,
      writable: true,
    });
    originalGetUserMedia = fakeMediaDevices.getUserMedia;
  }

  it("resolves with the stream when getUserMedia resolves before the timeout", async () => {
    const fakeStream: MockStream = {
      getTracks: () => [],
    };
    installMockGetUserMedia(async () => fakeStream);

    const result = await getUserMediaWithTimeout(
      { video: true },
      1000,
      "should not be thrown",
    );
    expect(result).toBe(fakeStream);
  });

  it("passes an AbortSignal to getUserMedia when AbortController is available", async () => {
    const fakeStream: MockStream = { getTracks: () => [] };
    installMockGetUserMedia(async (constraints) => {
      // Verify the signal is present and is an AbortSignal
      expect(constraints.signal).toBeInstanceOf(AbortSignal);
      return fakeStream;
    });

    await getUserMediaWithTimeout({ video: true }, 1000, "msg");
  });

  it("rejects with the timeout message when getUserMedia does not resolve in time", async () => {
    let resolveGetUserMedia: ((stream: MockStream) => void) | null = null;
    installMockGetUserMedia(
      () =>
        new Promise<MockStream>((resolve) => {
          resolveGetUserMedia = resolve;
        }),
    );

    await expect(
      getUserMediaWithTimeout({ video: true }, 50, "Camera setup timed out"),
    ).rejects.toThrow("Camera setup timed out");

    // Simulate the late resolution that the cleanup handler must catch.
    // If the bug regresses (no cleanup), the .stop() spy will not be called
    // and the track will leak.
    const lateStream: MockStream = {
      getTracks: () => [{ stop: vi.fn() }],
    };
    resolveGetUserMedia?.(lateStream);
    // Yield a few microtasks so the cleanup chain runs.
    await new Promise((r) => setTimeout(r, 0));
  });

  it("stops tracks on a late-resolving stream when the timer wins (Safari fallback path)", async () => {
    let resolveGetUserMedia: ((stream: MockStream) => void) | null = null;
    installMockGetUserMedia(
      () =>
        new Promise<MockStream>((resolve) => {
          resolveGetUserMedia = resolve;
        }),
    );

    const stopSpy = vi.fn();
    const lateStream: MockStream = {
      getTracks: () => [{ stop: stopSpy }],
    };

    // Race the timeout rejection against the late resolution.
    const result = getUserMediaWithTimeout(
      { video: true },
      50,
      "Camera setup timed out",
    );
    // Resolve the getUserMedia promise 100ms later (after the timeout).
    setTimeout(() => resolveGetUserMedia?.(lateStream), 100);

    await expect(result).rejects.toThrow("Camera setup timed out");
    // Wait for the late resolution + cleanup chain.
    await new Promise((r) => setTimeout(r, 150));
    expect(stopSpy).toHaveBeenCalled();
  });

  it("propagates the original rejection when getUserMedia rejects synchronously", async () => {
    installMockGetUserMedia(async () => {
      throw new Error("NotAllowedError");
    });

    await expect(
      getUserMediaWithTimeout({ video: true }, 1000, "should not be thrown"),
    ).rejects.toThrow("NotAllowedError");
  });
});
