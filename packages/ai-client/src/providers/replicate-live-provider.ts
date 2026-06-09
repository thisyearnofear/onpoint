/**
 * ReplicateLiveProvider — Polling-based live session using GPT-4o-mini via Replicate
 *
 * Architecture:
 * 1. Captures video frames at regular intervals
 * 2. Sends frames to /api/ai/replicate-analyze (Next.js proxy)
 * 3. Next.js calls Replicate API with server-side REPLICATE_API_TOKEN
 * 4. Emits reasoning/response events like the other live providers
 *
 * Used as the free-mium tier between Venice (free, Qwen) and Gemini (premium, WebSocket).
 * GPT-4o-mini provides significantly better vision analysis than Qwen,
 * without the WebSocket complexity or cost of Gemini.
 */

import { LiveSession } from "./base-provider";

interface ReplicateLiveConfig {
  pollingIntervalMs?: number;
}

export class ReplicateLiveProvider {
  private config: ReplicateLiveConfig;
  private listeners: Record<string, ((data: unknown) => void)[]> = {};
  private isConnected = false;
  private frameCount = 0;
  private lastAnalysis: string | null = null;
  private consecutiveErrors = 0;

  constructor(config: ReplicateLiveConfig = {}) {
    this.config = {
      pollingIntervalMs: 2500,
      ...config,
    };
  }

  createSession(goal: string, persona?: string): LiveSession {
    const self = this;
    const emit = (event: string, data: unknown) => {
      (self.listeners[event] ?? []).forEach((cb) => cb(data));
    };

    const analyzeFrame = async (imageData: string | Blob): Promise<void> => {
      try {
        emit("analyzing", true);

        // Convert to base64 if needed
        let base64Image: string;
        if (typeof imageData === "string") {
          base64Image = imageData;
        } else {
          const buffer = await imageData.arrayBuffer();
          base64Image = `data:image/jpeg;base64,${Buffer.from(buffer).toString("base64")}`;
        }

        const response = await fetch("/api/ai/replicate-analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: base64Image,
            goal: goal || "daily",
            persona,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMsg = errorData.error || "Analysis failed";

          if (response.status === 429) {
            emit("reasoning", "Pausing analysis — rate limit reached.");
            return;
          }

          throw new Error(errorMsg);
        }

        const data = await response.json();
        const analysis = data.analysis as string;

        if (analysis) {
          self.lastAnalysis = analysis;
          self.consecutiveErrors = 0;

          // Emit full response
          emit("response", analysis);

          // Parse into reasoning chunks with staggered delivery
          const chunks = analysis
            .split(/[.!?]+/)
            .filter((s: string) => s.trim().length > 5);

          for (let i = 0; i < Math.min(chunks.length, 3); i++) {
            const chunk = chunks[i]?.trim();
            if (chunk) {
              const delay = i === 0 ? 0 : 300 + chunk.length * 8;
              setTimeout(() => {
                emit("reasoning", chunk);
              }, delay);
            }
          }

          // Protocol events at milestones
          if (self.frameCount === 1) {
            emit("protocol", {
              step: "SCAN",
              text: "Initial style assessment complete.",
            });
          } else if (self.frameCount === 3) {
            emit("protocol", {
              step: "ANALYZE",
              text: "Deep analysis active — GPT-4o vision engaged.",
            });
          } else if (self.frameCount === 5) {
            emit("protocol", {
              step: "RECOMMEND",
              text: "Style recommendations ready.",
            });
          }
        }
      } catch (error) {
        self.consecutiveErrors++;
        const msg =
          error instanceof Error ? error.message : "Analysis failed";

        if (self.lastAnalysis && self.consecutiveErrors <= 3) {
          emit("reasoning", `⚠ Connection issue — showing last analysis`);
          emit("response", self.lastAnalysis);
        } else {
          emit("reasoning", `⚠ ${msg} — retrying next frame…`);
        }
      } finally {
        emit("analyzing", false);
      }
    };

    return {
      connect: async () => {
        self.isConnected = true;
        emit("connected", true);
        emit("protocol", {
          step: "INIT",
          text: "Connecting to Replicate AI Vision...",
        });

        await new Promise((r) => setTimeout(r, 400));
        emit("protocol", {
          step: "READY",
          text: "Fashion analysis active. Frame capture enabled.",
        });
        emit("reasoning", "Initializing AI vision scanner...");
      },

      disconnect: () => {
        self.isConnected = false;
        emit("disconnected", true);
      },

      sendAudio: (_audioData: ArrayBuffer) => {
        // Replicate doesn't support audio — silently ignore
      },

      sendImage: async (
        imageData: string | Blob,
        _framePixels?: Uint8ClampedArray,
      ) => {
        if (!self.isConnected) return;

        self.frameCount++;
        emit("reasoning", `Analyzing frame ${self.frameCount}...`);

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
