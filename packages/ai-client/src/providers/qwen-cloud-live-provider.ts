import { LiveSession } from "./base-provider";

interface QwenCloudLiveConfig {
  pollingIntervalMs?: number;
  systemInstruction?: string;
  /**
   * Optional model override. Defaults to "qwen3-vl-flash" (cheapest
   * vision-capable model on Qwen Cloud). Set QWEN_CLOUD_VISION_MODEL
   * in the server env to override.
   */
  model?: string;
}

/**
 * QwenCloudLiveProvider — Polling-based live session via Qwen Cloud (DashScope).
 *
 * Qwen Cloud Hackathon, Track 4: Autopilot Agent. Mirrors the
 * ZeroGLiveProvider shape but routes through /api/ai/qwen-analyze, which
 * calls Qwen Cloud directly (https://dashscope-intl.aliyuncs.com).
 *
 * Trade-offs vs 0G Live (same shape, different model):
 * - Vision calls routed directly to Qwen Cloud (first-party)
 * - Default model: qwen3-vl-flash, $0.05/M input, $0.40/M output (cheapest)
 * - Latency 1-2s (comparable to 0G, faster than Venice)
 * - No audio input (HTTP-only)
 * - No TEE attestation (Qwen Cloud does not currently surface proofs)
 */
export class QwenCloudLiveProvider {
  private config: QwenCloudLiveConfig;
  private listeners: Record<string, ((data: unknown) => void)[]> = {};
  private isConnected = false;
  private frameCount = 0;
  private lastAnalysis: string | null = null;
  private consecutiveErrors = 0;
  private modelId: string;

  constructor(config: QwenCloudLiveConfig = {}) {
    this.config = {
      pollingIntervalMs: 2500,
      ...config,
    };
    this.modelId = config.model ?? "qwen3-vl-flash";
  }

  /**
   * Creates a LiveSession that polls Qwen Cloud via our backend proxy.
   * Frame analysis is dispatched to /api/ai/qwen-analyze.
   */
  createSession(goal: string, systemInstruction?: string): LiveSession {
    const self = this;
    const emit = (event: string, data: unknown) => {
      (self.listeners[event] ?? []).forEach((cb) => cb(data));
    };

    const analyzeFrame = async (imageData: string | Blob): Promise<void> => {
      try {
        emit("analyzing", true);

        let base64Image: string;
        if (typeof imageData === "string") {
          base64Image = imageData;
        } else {
          const buffer = await imageData.arrayBuffer();
          base64Image = `data:image/jpeg;base64,${Buffer.from(buffer).toString("base64")}`;
        }

        const apiBase =
          typeof window !== "undefined"
            ? ""
            : (process.env.NEXT_PUBLIC_AGENT_API_URL || "");

        const response = await fetch(`${apiBase}/api/ai/qwen-analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: base64Image,
            goal: goal || "daily",
            systemInstruction,
            model: self.modelId,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMsg = errorData.error || "Analysis failed";

          if (response.status === 429) {
            emit("reasoning", "Pausing analysis — rate limit or budget reached.");
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

          // Stagger the response into a few reasoning chunks for a
          // more conversational feel.
          const chunks = analysis
            .split(/[.!?]+/)
            .filter((s: string) => s.trim().length > 5);
          for (let i = 0; i < Math.min(chunks.length, 3); i++) {
            const chunk = chunks[i]?.trim();
            if (chunk) {
              const delay = i === 0 ? 0 : 300 + chunk.length * 8;
              setTimeout(() => emit("reasoning", chunk), delay);
            }
          }

          // Surface spend info as a protocol milestone so the UI can
          // show the cost-aware nature of the agent.
          if (data.estimatedCostUsd !== undefined) {
            emit("protocol", {
              step: "VERIFY",
              text: `Qwen Cloud call: $${data.estimatedCostUsd.toFixed(6)} (daily spend: $${data.dailySpendUsd})`,
            });
          }

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
          text: `Connecting to Qwen Cloud (${self.modelId})…`,
        });
        await new Promise((r) => setTimeout(r, 500));
        emit("protocol", {
          step: "READY",
          text: "Style analysis active. Frame capture enabled.",
        });
        emit("reasoning", "Initializing style scanner on Qwen Cloud…");
      },

      disconnect: () => {
        self.isConnected = false;
        emit("disconnected", true);
      },

      sendAudio: () => {
        // Qwen Cloud is HTTP-only — no audio support.
      },

      sendImage: async (imageData) => {
        if (!self.isConnected) return;
        self.frameCount++;
        emit("reasoning", `Analyzing frame ${self.frameCount}…`);
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
