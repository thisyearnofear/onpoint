/**
 * AzureLiveProvider — Polling-based live session using Azure Computer Vision
 *
 * Architecture:
 * 1. Captures video frames at regular intervals
 * 2. Sends frames to /api/ai/azure-analyze (Next.js proxy)
 * 3. Next.js calls Azure Computer Vision API with server-side credentials
 * 4. Emits reasoning/response events like the other live providers
 *
 * Azure CV provides object detection (garment identification), tagging,
 * color analysis, and natural language captioning — useful for a
 * free-mium fashion analysis tier alongside Venice and Replicate.
 */

import { LiveSession } from "./base-provider";

interface AzureLiveConfig {
  pollingIntervalMs?: number;
}

export class AzureLiveProvider {
  private config: AzureLiveConfig;
  private listeners: Record<string, ((data: unknown) => void)[]> = {};
  private isConnected = false;
  private frameCount = 0;
  private lastAnalysis: string | null = null;
  private consecutiveErrors = 0;

  constructor(config: AzureLiveConfig = {}) {
    this.config = {
      pollingIntervalMs: 3000,
      ...config,
    };
  }

  createSession(goal: string, _persona?: string): LiveSession {
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

        const response = await fetch("/api/ai/azure-analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: base64Image,
            goal: goal || "daily",
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
              text: "Object detection and color analysis active.",
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
          text: "Connecting to Azure Computer Vision...",
        });

        await new Promise((r) => setTimeout(r, 400));
        emit("protocol", {
          step: "READY",
          text: "Vision analysis active. Frame capture enabled.",
        });
        emit("reasoning", "Initializing visual analysis...");
      },

      disconnect: () => {
        self.isConnected = false;
        emit("disconnected", true);
      },

      sendAudio: (_audioData: ArrayBuffer) => {
        // Azure CV doesn't support audio
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
