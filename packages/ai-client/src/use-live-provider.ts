/**
 * useLiveProvider — Generic live session hook
 *
 * Replaces useGeminiLive and useVeniceLive with a single hook parameterized
 * by a LiveSessionFactory. The factory provides all provider-specific behavior
 * (camera audio, frame interval, session timer, provisioning, session creation).
 *
 * Usage:
 *   const factory = SESSION_FACTORIES[selectedProvider];
 *   const { isConnected, error, videoRef, startSession, ... } = useLiveProvider(factory);
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { LiveSession } from "./providers/base-provider";
import {
  classifyCameraError,
  checkCameraPermission,
  type CameraError,
  type CameraErrorStep,
} from "./camera-permissions";

// ── Public types ──

export interface SessionConfig {
  goal: string;
  apiKey?: string;
  persona?: string;
}

export interface ProvisionedSessionConfig {
  [key: string]: unknown;
}

export interface ProviderCard {
  /** Goal identifier that maps to a GOAL_OPTIONS entry */
  readonly goal: string;
  readonly title: string;
  readonly description: string;
  /** Lucide icon identifier (e.g. "zap", "crown", "star", "eye") */
  readonly icon: string;
  /** Tailwind color name (e.g. "emerald", "indigo", "amber", "rose") */
  readonly color: string;
  readonly badgeLabel: string;
}

export interface LiveSessionFactory {
  readonly name: string;
  readonly displayName: string;
  readonly isPremium: boolean;
  /** Whether this provider requires payment (e.g. Gemini paid sessions) */
  readonly requiresPayment: boolean;
  /** Whether this provider supports bring-your-own-key (BYOK) */
  readonly supportsByok: boolean;
  /** Provider selection cards shown on the home screen (per-goal options) */
  readonly cards: readonly ProviderCard[];
  /** Ordered list of provider names to fall back to if this provider fails */
  readonly fallbackChain?: readonly string[];
  /** Whether the provider supports real-time continuous frame streaming. */
  readonly realTimeFrames: boolean;
  supportsAudio(): boolean;
  frameIntervalMs(): number;
  sendFramePixels(): boolean;
  hasSessionTimer(): boolean;
  maxSessionDurationMs(): number;
  maxCaptures(): number;
  provisionSession(config: SessionConfig): Promise<ProvisionedSessionConfig>;
  createSession(
    provisionedConfig: ProvisionedSessionConfig,
    goal: string,
  ): LiveSession | Promise<LiveSession>;
}

// ── Inert null factory (used when no provider is selected) ──

const NULL_FACTORY: LiveSessionFactory = {
  name: "",
  displayName: "",
  isPremium: false,
  requiresPayment: false,
  supportsByok: false,
  cards: [],
  realTimeFrames: false,
  supportsAudio: () => false,
  frameIntervalMs: () => 1000,
  sendFramePixels: () => false,
  hasSessionTimer: () => false,
  maxSessionDurationMs: () => 0,
  maxCaptures: () => 0,
  provisionSession: async () => ({}),
  createSession: async () => {
    throw new Error("No provider selected");
  },
};

// ── Hook return type ──

export interface LiveProviderState {
  isConnected: boolean;
  isInitializing: boolean;
  isAnalyzing: boolean;
  error: string | null;
  /**
   * Structured error for camera-related failures. When set, the UI should
   * render a dedicated recovery screen with browser-specific instructions
   * (see CameraBlocked). When null, fall back to the generic `error` string.
   */
  cameraError: CameraError | null;
  transcript: string;
  aiResponse: string;
  reasoning: string[];
  agentEvents: unknown[];
  videoRef: React.RefObject<HTMLVideoElement | null>;
  startSession: (
    sessionGoal?: string,
    userApiKey?: string,
    persona?: string,
  ) => Promise<void>;
  stopSession: () => void;
  sessionTimeRemaining: number | undefined;
  sessionExpired: boolean;
  maxCaptures: number;
  providerDisplayName: string;
  isPremium: boolean;
  requiresPayment: boolean;
  supportsByok: boolean;
  latencyMs: number;
  provider: string;
}

// ── Helpers ──

/**
 * Default timeout for the overall startSession flow. Long enough to absorb
 * slow networks and a delayed camera-permission prompt, short enough that
 * users don't give up and bail.
 */
const SESSION_SETUP_TIMEOUT_MS = 15_000;

/**
 * Race a promise against a timeout. If the timeout wins, reject with a
 * user-friendly message that the caller can surface verbatim.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

// ── Hook ──

export function useLiveProvider(factory: LiveSessionFactory): LiveProviderState {
  const [isConnected, setIsConnected] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<CameraError | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [aiResponse, setAiResponse] = useState<string>("");
  const [reasoning, setReasoning] = useState<string[]>([]);
  const [agentEvents, setAgentEvents] = useState<unknown[]>([]);
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState<
    number | undefined
  >(undefined);
  const [sessionExpired, setSessionExpired] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<LiveSession | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const factoryRef = useRef(factory);
  const lastFrameTimeRef = useRef(0);
  const frameSendInFlightRef = useRef(false);
  const [latencyMs, setLatencyMs] = useState(0);

  // Track factory identity to detect provider switches
  // When the factory changes mid-session, stop the old session cleanly.
  // endProvisionedSession reads from factoryRef.current so it always
  // uses the correct (previous) provider name for the teardown request.
  useEffect(() => {
    if (factoryRef.current.name !== factory.name && isConnected) {
      stopSession();
    }
    factoryRef.current = factory;
  }, [factory.name]);

  const clearTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const releaseStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const endProvisionedSession = useCallback(() => {
    // Read from ref so stale closures always get the correct provider name
    fetch("/api/ai/live-session/end", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: factoryRef.current.name }),
      keepalive: true,
    }).catch(() => {});
  }, []);

  const stopSession = useCallback(() => {
    clearTimer();
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    frameSendInFlightRef.current = false;
    if (sessionRef.current) {
      sessionRef.current.disconnect();
      sessionRef.current = null;
    }
    releaseStream();
    endProvisionedSession();
    setIsConnected(false);
    setTranscript("");
    setAiResponse("");
    setReasoning([]);
    setAgentEvents([]);
    setSessionTimeRemaining(
      factory.hasSessionTimer()
        ? factory.maxSessionDurationMs() / 1000
        : undefined,
    );
    setSessionExpired(false);
    setCameraError(null);
  }, [clearTimer, endProvisionedSession, factory, releaseStream]);

  const startSession = useCallback(
    async (
      sessionGoal?: string,
      userApiKey?: string,
      persona?: string,
    ) => {
      let provisioned = false;
      try {
        setIsInitializing(true);
        setError(null);
        setCameraError(null);
        setSessionExpired(false);
        if (factory.hasSessionTimer()) {
          setSessionTimeRemaining(factory.maxSessionDurationMs() / 1000);
        }

        // ── Step: precheck ──
        // If the Permissions API is available (Chromium / Firefox) and the
        // user has already denied camera access, skip getUserMedia entirely
        // and surface a structured recovery message. The browser will not
        // re-prompt, so there's no point in waiting for a timeout.
        const permState = await checkCameraPermission();
        if (permState === "denied") {
          throw classifyCameraError(
            { name: "NotAllowedError", message: "Permission denied" },
            "precheck",
          );
        }

        // ── Step: getUserMedia ──
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw classifyCameraError(
            { name: "SecurityError", message: "Camera API not available" },
            "getUserMedia",
          );
        }

        // Open camera first so permission failures do not consume a
        // provisioned backend session. Wrapped in a timeout so a hung
        // permission prompt doesn't leave the UI stuck on "initializing"
        // forever.
        const stream = await withTimeout(
          navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720, facingMode: "user" },
            audio: factory.supportsAudio(),
          }),
          SESSION_SETUP_TIMEOUT_MS,
          "Camera setup is taking longer than expected. Your browser may be blocking the camera. Try uploading a photo instead.",
        );
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        // ── Step: provision ──
        const provisionedConfig = await withTimeout(
          factory.provisionSession({
            goal: sessionGoal || "daily",
            apiKey: userApiKey,
            persona,
          }),
          SESSION_SETUP_TIMEOUT_MS,
          "Setting up your AI session is taking longer than expected. Our server may be busy. Try again, or upload a photo instead.",
        );
        provisioned = true;

        // ── Step: create ──
        const session = await withTimeout(
          Promise.resolve(
            factory.createSession(provisionedConfig, sessionGoal || "daily"),
          ),
          SESSION_SETUP_TIMEOUT_MS,
          "Connecting to your AI stylist timed out. Try again, or upload a photo instead.",
        );

        // Attach listeners
        const setTranscriptSafe = (text: unknown) =>
          setTranscript(text as string);
        const setResponseSafe = (text: unknown) =>
          setAiResponse((prev) => prev + " " + text);
        const setReasoningSafe = (text: unknown) => {
          // Track frame-to-response latency using exponential moving average
          if (lastFrameTimeRef.current > 0) {
            const elapsed = Date.now() - lastFrameTimeRef.current;
            setLatencyMs((prev) =>
              Math.round(prev * 0.65 + elapsed * 0.35),
            );
          }
          setReasoning((prev) =>
            [text as string, ...prev].slice(0, 10),
          );
        };
        const setAgentEventsSafe = (data: unknown) =>
          setAgentEvents((prev) =>
            [{ ...(data as object), id: Date.now() }, ...prev].slice(0, 5),
          );
        const setErrorSafe = (err: unknown) =>
          setError(
            typeof err === "string" ? err : (err as Error)?.message || "Session error",
          );
        const setAnalyzingSafe = (val: unknown) =>
          setIsAnalyzing(val as boolean);

        session.on("transcript", setTranscriptSafe);
        session.on("response", setResponseSafe);
        session.on("reasoning", setReasoningSafe);
        session.on("protocol", setAgentEventsSafe);
        session.on("error", setErrorSafe);
        session.on("disconnected", () => setIsConnected(false));
        session.on("analyzing", setAnalyzingSafe);

        // ── Step: connect ──
        await withTimeout(
          session.connect(),
          SESSION_SETUP_TIMEOUT_MS,
          "Connecting to your AI stylist timed out. Try again, or upload a photo instead.",
        );
        sessionRef.current = session;
        setIsConnected(true);

        // Start session countdown timer (for providers with session limits)
        if (factory.hasSessionTimer()) {
          timerIntervalRef.current = window.setInterval(() => {
            setSessionTimeRemaining((prev) => {
              const current = prev ?? factory.maxSessionDurationMs() / 1000;
              const next = current - 1;
              if (next <= 0) {
                clearTimer();
                setSessionExpired(true);
                if (frameIntervalRef.current) {
                  clearInterval(frameIntervalRef.current);
                  frameIntervalRef.current = null;
                }
                if (sessionRef.current) {
                  sessionRef.current.disconnect();
                  sessionRef.current = null;
                }
                releaseStream();
                endProvisionedSession();
                setIsConnected(false);
                return 0;
              }
              return next;
            });
          }, 1000);
        }

        // Start sending video frames for analysis (only for real-time streaming providers)
        if (factory.realTimeFrames) {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          frameIntervalRef.current = window.setInterval(async () => {
            const video = videoRef.current;
            const session = sessionRef.current;
            if (!video || !ctx || !session || frameSendInFlightRef.current) {
              return;
            }

            if (
              video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
              video.videoWidth === 0 ||
              video.videoHeight === 0
            ) {
              return;
            }

            try {
              frameSendInFlightRef.current = true;
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const base64Image = canvas.toDataURL("image/jpeg", 0.7);

              lastFrameTimeRef.current = Date.now();
              if (factory.sendFramePixels()) {
                const pixels = ctx.getImageData(
                  0,
                  0,
                  canvas.width,
                  canvas.height,
                ).data;
                await session.sendImage(base64Image, pixels);
              } else {
                await session.sendImage(base64Image);
              }
            } finally {
              frameSendInFlightRef.current = false;
            }
          }, factory.frameIntervalMs());
        }
      } catch (err: unknown) {
        releaseStream();
        if (provisioned) {
          endProvisionedSession();
        }
        // Classify the error so the UI can render a tailored recovery
        // message. If the error came from the camera flow (precheck,
        // getUserMedia) it becomes a structured CameraError; everything
        // else falls through to the generic string error.
        if (err && typeof err === "object" && "kind" in err && "step" in err) {
          const camErr = err as CameraError;
          // We don't know the original step for a rethrown wrapper, so
          // best-effort: assume the failing step is the one we tagged.
          setCameraError(camErr);
          console.warn("Camera error:", camErr);
        } else {
          const errorMessage =
            err instanceof Error
              ? err.message
              : "Failed to start live session";
          // Still try to classify a plain Error in case it's a getUserMedia
          // DOMException that didn't go through our precheck path (e.g.
          // Safari, where Permissions API is unsupported).
          if (err && typeof err === "object" && "name" in err) {
            const step: CameraErrorStep = navigator.mediaDevices
              ? "getUserMedia"
              : "precheck";
            setCameraError(classifyCameraError(err, step));
          } else {
            setError(errorMessage);
          }
          console.error(err);
        }
        throw err instanceof Error ? err : new Error("Session start failed");
      } finally {
        setIsInitializing(false);
      }
    },
    [
      clearTimer,
      endProvisionedSession,
      factory,
      releaseStream,
    ],
  );

  return {
    isConnected,
    isInitializing,
    isAnalyzing,
    error,
    cameraError,
    transcript,
    aiResponse,
    reasoning,
    agentEvents,
    videoRef,
    startSession,
    stopSession,
    sessionTimeRemaining,
    sessionExpired,
    maxCaptures: factory.maxCaptures(),
    providerDisplayName: factory.displayName,
    isPremium: factory.isPremium,
    requiresPayment: factory.requiresPayment,
    supportsByok: factory.supportsByok,
    latencyMs,
    provider: factory.name,
  };
}

export { NULL_FACTORY };
