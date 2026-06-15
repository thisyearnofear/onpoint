import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLiveProvider, type LiveSessionFactory } from "@repo/ai-client";

// ── Mock helpers ──

let mockVideoPlay: ReturnType<typeof vi.fn>;

function createMockTrack(kind: "video" | "audio" = "video") {
  return {
    kind,
    stop: vi.fn(),
    readyState: "live" as const,
    enabled: true,
  } as unknown as MediaStreamTrack;
}

function createMockStream(tracks = [createMockTrack("video")]): MediaStream {
  return {
    getTracks: () => tracks,
    getVideoTracks: () => tracks.filter((t) => t.kind === "video"),
    getAudioTracks: () => tracks.filter((t) => t.kind === "audio"),
    addTrack: vi.fn(),
    removeTrack: vi.fn(),
    clone: vi.fn(),
    getTrackById: vi.fn(),
    active: true,
    id: "mock-stream",
  } as unknown as MediaStream;
}

function createMockLiveSession() {
  return {
    on: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    sendImage: vi.fn().mockResolvedValue(undefined),
  };
}

function createFactory(): LiveSessionFactory {
  const mockSession = createMockLiveSession();
  return {
    name: "test",
    displayName: "Test Provider",
    isPremium: false,
    requiresPayment: false,
    supportsByok: false,
    cards: [],
    fallbackChain: [],
    realTimeFrames: false,
    supportsAudio: () => false,
    frameIntervalMs: () => 1000,
    sendFramePixels: () => false,
    hasSessionTimer: () => false,
    maxSessionDurationMs: () => 0,
    maxCaptures: () => 0,
    provisionSession: vi.fn().mockResolvedValue({}),
    createSession: vi.fn().mockResolvedValue(mockSession),
  };
}

function setupVideoElement(): HTMLVideoElement {
  const video = document.createElement("video");
  mockVideoPlay = vi.fn().mockResolvedValue(undefined);
  vi.spyOn(video, "play").mockImplementation(mockVideoPlay);
  return video;
}

// ── Tests ──

describe("useLiveProvider integration — camera launch flow", () => {
  beforeEach(() => {
    // Silence network requests from endProvisionedSession
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
    } as Response);

    // Ensure navigator.mediaDevices.getUserMedia exists and is mockable.
    // jsdom's navigator may not have mediaDevices at all, so define it
    // with a mock getUserMedia that succeeds by default.
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(createMockStream()),
      },
      configurable: true,
      writable: true,
    });

    // Make permissions API return "prompt" by default (so precheck passes)
    Object.defineProperty(navigator, "permissions", {
      value: {
        query: vi
          .fn()
          .mockResolvedValue({ state: "prompt" } as PermissionStatus),
      },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts with idle state", () => {
    const { result } = renderHook(() => useLiveProvider(createFactory()));

    expect(result.current.isConnected).toBe(false);
    expect(result.current.isInitializing).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.cameraError).toBeNull();
  });

  it("successfully launches camera, provisions, creates session, and connects", async () => {
    const { result } = renderHook(() => useLiveProvider(createFactory()));

    // Wire up a real <video> element so the play() path executes
    const video = setupVideoElement();
    result.current.videoRef.current = video;

    await act(async () => {
      await result.current.startSession("daily");
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.isInitializing).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.cameraError).toBeNull();
    expect(mockVideoPlay).toHaveBeenCalledTimes(1);
  });

  it("returns cameraError=permission_denied when the permissions API reports denial", async () => {
    // Override permissions to deny
    Object.defineProperty(navigator, "permissions", {
      value: {
        query: vi
          .fn()
          .mockResolvedValue({ state: "denied" } as PermissionStatus),
      },
      configurable: true,
    });

    const { result } = renderHook(() => useLiveProvider(createFactory()));

    await act(async () => {
      await result.current.startSession("daily");
    });

    expect(result.current.cameraError?.kind).toBe("permission_denied");
    expect(result.current.cameraError?.step).toBe("precheck");
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isInitializing).toBe(false);
  });

  it("handles getUserMedia timeout and classifies as timeout kind", async () => {
    // Intercept setTimeout to shorten the 30s camera timeout to near-zero.
    // Using vi.useFakeTimers() is not an option — it breaks React's
    // internal scheduler that act() depends on. Instead, we spy on
    // setTimeout and replace the 30_000ms camera timeout with 5ms so it
    // fires almost immediately while keeping all other timers real.
    const originalSetTimeout = globalThis.setTimeout.bind(globalThis);
    vi.spyOn(globalThis, "setTimeout").mockImplementation(
      (
        fn: (...args: unknown[]) => void,
        ms?: number,
        ...args: unknown[]
      ) => {
        if (ms === 30_000) {
          return originalSetTimeout(fn, 5, ...args);
        }
        return originalSetTimeout(fn, ms as number, ...args);
      },
    ) as unknown as typeof globalThis.setTimeout;

    // getUserMedia hangs forever (simulates a stalled permission prompt)
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: vi.fn(() => new Promise<MediaStream>(() => {})),
      },
      configurable: true,
      writable: true,
    });

    const { result } = renderHook(() => useLiveProvider(createFactory()));

    // Start session — getUserMedia hangs, but the shortened timeout
    // fires after ~5ms and triggers the abortableTimeout rejection.
    await act(async () => {
      await result.current.startSession("daily");
    });

    expect(result.current.cameraError?.kind).toBe("timeout");
    expect(result.current.cameraError?.step).toBe("getUserMedia");
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isInitializing).toBe(false);
  });

  it("handles autoplay failure and classifies as playback_blocked", async () => {
    const video = setupVideoElement();
    // Simulate autoplay being blocked (iOS Low Power Mode, Data Saver, etc.)
    mockVideoPlay.mockRejectedValue(
      new DOMException("play() failed because autoplay was blocked"),
    );

    const { result } = renderHook(() => useLiveProvider(createFactory()));
    result.current.videoRef.current = video;

    await act(async () => {
      await result.current.startSession("daily");
    });

    expect(result.current.cameraError?.kind).toBe("playback_blocked");
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isInitializing).toBe(false);
  });

  it("handles getUserMedia NotReadableError and classifies as in_use", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: vi.fn().mockRejectedValue(
          new DOMException("Could not start video source", "NotReadableError"),
        ),
      },
      configurable: true,
      writable: true,
    });

    const { result } = renderHook(() => useLiveProvider(createFactory()));

    await act(async () => {
      await result.current.startSession("daily");
    });

    expect(result.current.cameraError?.kind).toBe("in_use");
    expect(result.current.cameraError?.step).toBe("getUserMedia");
    expect(result.current.isConnected).toBe(false);
  });

  it("handles getUserMedia NotAllowedError and classifies as permission_denied", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: vi.fn().mockRejectedValue(
          new DOMException("Permission denied", "NotAllowedError"),
        ),
      },
      configurable: true,
      writable: true,
    });

    const { result } = renderHook(() => useLiveProvider(createFactory()));

    await act(async () => {
      await result.current.startSession("daily");
    });

    expect(result.current.cameraError?.kind).toBe("permission_denied");
    expect(result.current.isConnected).toBe(false);
  });

  it("stops session cleanly — disconnects, releases stream, resets state", async () => {
    const { result } = renderHook(() => useLiveProvider(createFactory()));

    const video = setupVideoElement();
    result.current.videoRef.current = video;

    // Start a session
    await act(async () => {
      await result.current.startSession("daily");
    });
    expect(result.current.isConnected).toBe(true);

    // Now stop it
    act(() => {
      result.current.stopSession();
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.transcript).toBe("");
    expect(result.current.reasoning).toEqual([]);
    expect(result.current.agentEvents).toEqual([]);
    expect(result.current.sessionTimeRemaining).toBeUndefined();
    expect(result.current.cameraError).toBeNull();
  });
});

// ── Fallback chain + factory override tests ──

import { SESSION_FACTORIES } from "@repo/ai-client";

describe("useLiveProvider — factoryOverride and fallback chain", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
    } as Response);

    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(createMockStream()),
      },
      configurable: true,
      writable: true,
    });

    Object.defineProperty(navigator, "permissions", {
      value: {
        query: vi
          .fn()
          .mockResolvedValue({ state: "prompt" } as PermissionStatus),
      },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("uses factoryOverride instead of the hook's factory", async () => {
    const primaryFactory = createFactory();
    const overrideFactory = {
      ...createFactory(),
      name: "override",
      displayName: "Override Provider",
    };

    const { result } = renderHook(() => useLiveProvider(primaryFactory));
    const video = setupVideoElement();
    result.current.videoRef.current = video;

    await act(async () => {
      await result.current.startSession(
        "daily",
        undefined,
        undefined,
        overrideFactory,
      );
    });

    expect(result.current.isConnected).toBe(true);
    expect(primaryFactory.provisionSession).not.toHaveBeenCalled();
    expect(overrideFactory.provisionSession).toHaveBeenCalledTimes(1);
  });

  it("walks the fallback chain when the primary provisionSession throws", async () => {
    const primaryFactory = {
      ...createFactory(),
      name: "failing-primary",
      fallbackChain: ["fallback-target"],
    };
    (primaryFactory.provisionSession as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Primary is down"),
    );

    const fallbackFactory = {
      ...createFactory(),
      name: "fallback-target",
    };

    // Register the fallback in the live registry so resolveFallbackChain
    // can find it. Clean up after the test.
    SESSION_FACTORIES["fallback-target"] = fallbackFactory;

    const { result } = renderHook(() => useLiveProvider(primaryFactory));
    const video = setupVideoElement();
    result.current.videoRef.current = video;

    await act(async () => {
      await result.current.startSession("daily");
    });

    expect(result.current.isConnected).toBe(true);
    expect(primaryFactory.provisionSession).toHaveBeenCalledTimes(1);
    expect(fallbackFactory.provisionSession).toHaveBeenCalledTimes(1);

    delete SESSION_FACTORIES["fallback-target"];
  });

  it("filters premium providers (disableFallback) from the chain when no BYOK", async () => {
    const primaryFactory = {
      ...createFactory(),
      name: "free-primary",
      fallbackChain: ["premium-terminal"],
    };
    (primaryFactory.provisionSession as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Free primary is down"),
    );

    const premiumFactory = {
      ...createFactory(),
      name: "premium-terminal",
      isPremium: true,
      requiresPayment: true,
      disableFallback: true,
    };

    SESSION_FACTORIES["premium-terminal"] = premiumFactory;

    const { result } = renderHook(() => useLiveProvider(primaryFactory));
    const video = setupVideoElement();
    result.current.videoRef.current = video;

    await act(async () => {
      // No BYOK key — premium should be skipped
      await result.current.startSession("daily");
    });

    // Primary was tried, premium was filtered out, so no fallback happened
    expect(primaryFactory.provisionSession).toHaveBeenCalledTimes(1);
    expect(premiumFactory.provisionSession).not.toHaveBeenCalled();
    // Session failed because no provider was available
    expect(result.current.isConnected).toBe(false);

    delete SESSION_FACTORIES["premium-terminal"];
  });
});
