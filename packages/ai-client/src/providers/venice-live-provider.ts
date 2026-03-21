import { LiveSession } from "./base-provider";

interface VeniceLiveConfig {
  pollingIntervalMs?: number;
  adaptivePolling?: boolean;
  systemInstruction?: string;
}

/**
 * VeniceLiveProvider - Polling-based "live" session using Venice AI via backend proxy
 *
 * This provider:
 * 1. Captures video frames at regular intervals
 * 2. Sends frames to our backend /api/ai/venice-analyze endpoint
 * 3. Backend proxies to Venice AI (keeps API key secure)
 * 4. Emits reasoning events to simulate real-time stream
 *
 * Trade-offs vs Gemini Live:
 * - Higher latency (2-5s per frame)
 * - No true bidirectional streaming
 * - No audio input support
 * - But: FREE to use (we provide the API key via backend)
 */
export class VeniceLiveProvider {
  private config: VeniceLiveConfig;
  private listeners: Record<string, ((data: unknown) => void)[]> = {};
  private isConnected = false;
  private frameCount = 0;
  private previousFrameData: Uint8ClampedArray | null = null;
  private motionLevel = 0;

  constructor(config: VeniceLiveConfig = {}) {
    this.config = {
      pollingIntervalMs: 3000,
      adaptivePolling: true,
      ...config,
    };
  }

  /**
   * Simple motion detection using frame difference
   */
  private detectMotion(currentFrameData: Uint8ClampedArray): number {
    const prevFrame = this.previousFrameData;
    if (!prevFrame) {
      this.previousFrameData = currentFrameData;
      return 50;
    }

    let diff = 0;
    const sampleSize = Math.min(currentFrameData.length, prevFrame.length);
    const sampleStep = 16;

    for (let i = 0; i < sampleSize; i += sampleStep) {
      if (i % 4 !== 3) {
        diff += Math.abs(currentFrameData[i]! - prevFrame[i]!);
      }
    }

    this.previousFrameData = currentFrameData;

    const maxDiff = (sampleSize / sampleStep) * (3 / 4) * 255;
    const normalizedDiff = (diff / maxDiff) * 100;

    this.motionLevel = this.motionLevel * 0.7 + normalizedDiff * 0.3;

    return Math.min(100, Math.max(0, this.motionLevel));
  }

  /**
   * Get adaptive polling interval based on motion level
   */
  private getAdaptivePollingInterval(): number {
    if (!this.config.adaptivePolling) {
      return this.config.pollingIntervalMs ?? 3000;
    }

    if (this.motionLevel > 30) {
      return 2000;
    } else if (this.motionLevel < 10) {
      return 5000;
    }
    return this.config.pollingIntervalMs ?? 3000;
  }

  /**
   * Creates a LiveSession that polls via backend proxy
   */
  createSession(goal: string, systemInstruction?: string): LiveSession {
    const self = this;
    const emit = (event: string, data: unknown) => {
      (self.listeners[event] ?? []).forEach((cb) => cb(data));
    };

    const analyzeFrame = async (imageData: string | Blob): Promise<void> => {
      try {
        // Convert to base64 if needed
        let base64Image: string;
        if (typeof imageData === "string") {
          base64Image = imageData;
        } else {
          const buffer = await imageData.arrayBuffer();
          base64Image = `data:image/jpeg;base64,${Buffer.from(buffer).toString("base64")}`;
        }

        // Call our backend proxy
        const response = await fetch("/api/ai/venice-analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: base64Image,
            goal: goal || "daily",
            systemInstruction,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Analysis failed");
        }

        const data = await response.json();
        const analysis = data.analysis as string;

        if (analysis) {
          // Parse analysis into reasoning chunks
          const chunks = analysis
            .split(/[.!?]+/)
            .filter((s: string) => s.trim().length > 5);

          // Emit each chunk with delay to simulate "live" feeling
          for (let i = 0; i < Math.min(chunks.length, 3); i++) {
            const chunk = chunks[i]?.trim();
            if (chunk) {
              setTimeout(() => {
                emit("reasoning", chunk);
              }, i * 800);
            }
          }

          // Emit full response
          emit("response", analysis);

          // Emit protocol events at milestones
          if (self.frameCount === 1) {
            emit("protocol", {
              step: "SCAN",
              text: "Initial style assessment complete.",
            });
          } else if (self.frameCount === 3) {
            emit("protocol", {
              step: "ANALYZE",
              text: "Pattern recognition active.",
            });
          } else if (self.frameCount === 5) {
            emit("protocol", {
              step: "RECOMMEND",
              text: "Style recommendations ready.",
            });
          }

          // Emit approval badges for positive feedback
          const positiveWords = [
            "good",
            "great",
            "excellent",
            "sharp",
            "love",
            "perfect",
            "solid",
          ];
          const hasPositive = positiveWords.some((w) =>
            analysis.toLowerCase().includes(w),
          );
          if (hasPositive && self.frameCount > 2) {
            emit("reasoning", "Looking good! Current styling is on point.");
          }
        }
      } catch (error) {
        console.error("[VeniceLiveProvider] Analysis error:", error);
        emit(
          "error",
          error instanceof Error ? error.message : "Analysis failed",
        );
      }
    };

    return {
      connect: async () => {
        self.isConnected = true;
        emit("connected", true);
        emit("protocol", {
          step: "INIT",
          text: "Connecting to Venice AI Stylist...",
        });

        // Simulate connection delay
        await new Promise((r) => setTimeout(r, 500));
        emit("protocol", {
          step: "READY",
          text: "Style analysis active. Frame capture enabled.",
        });
        emit("reasoning", "Initializing style scanner...");
      },

      disconnect: () => {
        self.isConnected = false;
        emit("disconnected", true);
      },

      sendAudio: (_audioData: ArrayBuffer) => {
        // Venice doesn't support audio - silently ignore
      },

      sendImage: async (imageData: string | Blob) => {
        if (!self.isConnected) return;

        self.frameCount++;
        emit("reasoning", `Analyzing frame ${self.frameCount}...`);

        // Analyze the frame
        await analyzeFrame(imageData);
      },

      on: (event, callback) => {
        if (!self.listeners[event]) self.listeners[event] = [];
        self.listeners[event].push(callback);
      },

      off: (event, callback) => {
        if (!self.listeners[event]) return;
        self.listeners[event] = self.listeners[event].filter(
          (cb) => cb !== callback,
        );
      },
    };
  }
}
