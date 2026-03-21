import { useState, useCallback, useRef } from "react";
import { LiveSession } from "./providers/base-provider";
import { VeniceLiveProvider } from "./providers/venice-live-provider";

const VENICE_FREE_SESSION_SECONDS = 60; // 1 minute
const VENICE_WARNING_THRESHOLD = 30; // warn at 30s remaining

export function useVeniceLive() {
  const [isConnected, setIsConnected] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [aiResponse, setAiResponse] = useState<string>("");
  const [reasoning, setReasoning] = useState<string[]>([]);
  const [agentEvents, setAgentEvents] = useState<unknown[]>([]);
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState<number>(
    VENICE_FREE_SESSION_SECONDS,
  );
  const [sessionExpired, setSessionExpired] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<LiveSession | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const startSession = useCallback(
    async (sessionGoal?: string) => {
      try {
        setIsInitializing(true);
        setError(null);
        setSessionExpired(false);
        setSessionTimeRemaining(VENICE_FREE_SESSION_SECONDS);

        // Get user media for video
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: "user" },
          audio: false, // Venice doesn't support audio
        });
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Verify session can be started (rate limiting check)
        const response = await fetch("/api/ai/live-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            goal: sessionGoal || "daily",
            provider: "venice",
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to connect to Venice AI");
        }

        // Create Venice Live provider (uses backend proxy, no API key needed)
        const provider = new VeniceLiveProvider({
          pollingIntervalMs: 3000,
        });

        const session = provider.createSession(sessionGoal || "daily");

        // Attach listeners
        session.on("transcript", (text) => setTranscript(text as string));
        session.on("response", (text) =>
          setAiResponse((prev) => prev + " " + text),
        );
        session.on("reasoning", (text) =>
          setReasoning((prev) => [text as string, ...prev].slice(0, 10)),
        );
        session.on("protocol", (data) =>
          setAgentEvents((prev) =>
            [{ ...data, id: Date.now() }, ...prev].slice(0, 5),
          ),
        );
        session.on("error", (err) => setError(err as string));
        session.on("disconnected", () => setIsConnected(false));

        await session.connect();
        sessionRef.current = session;
        setIsConnected(true);

        // Start session countdown timer
        timerIntervalRef.current = window.setInterval(() => {
          setSessionTimeRemaining((prev) => {
            const next = prev - 1;
            if (next <= 0) {
              clearTimer();
              setSessionExpired(true);
              // Auto-stop session
              if (frameIntervalRef.current) {
                clearInterval(frameIntervalRef.current);
                frameIntervalRef.current = null;
              }
              if (sessionRef.current) {
                sessionRef.current.disconnect();
                sessionRef.current = null;
              }
              if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
                streamRef.current = null;
              }
              if (videoRef.current) {
                videoRef.current.srcObject = null;
              }
              setIsConnected(false);
              return 0;
            }
            return next;
          });
        }, 1000);

        // Start sending video frames (polling every 3 seconds for Venice)
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        frameIntervalRef.current = window.setInterval(() => {
          if (videoRef.current && ctx && sessionRef.current) {
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            ctx.drawImage(videoRef.current, 0, 0);
            const base64Image = canvas.toDataURL("image/jpeg", 0.7);
            sessionRef.current.sendImage(base64Image);
          }
        }, 3000); // Poll every 3 seconds for Venice
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to start live session";
        setError(errorMessage);
        console.error(err);
      } finally {
        setIsInitializing(false);
      }
    },
    [clearTimer],
  );

  const stopSession = useCallback(() => {
    clearTimer();
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    if (sessionRef.current) {
      sessionRef.current.disconnect();
      sessionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsConnected(false);
    setTranscript("");
    setAiResponse("");
    setReasoning([]);
    setAgentEvents([]);
    setSessionTimeRemaining(VENICE_FREE_SESSION_SECONDS);
    setSessionExpired(false);
  }, [clearTimer]);

  return {
    isConnected,
    isInitializing,
    error,
    transcript,
    aiResponse,
    reasoning,
    agentEvents,
    videoRef,
    startSession,
    stopSession,
    sessionTimeRemaining,
    sessionExpired,
    provider: "venice" as const,
  };
}
