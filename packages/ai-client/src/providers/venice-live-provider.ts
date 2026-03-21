import OpenAI from "openai";
import { LiveSession } from "./base-provider";

interface VeniceLiveConfig {
  apiKey: string;
  baseUrl?: string;
  pollingIntervalMs?: number;
  systemInstruction?: string;
  adaptivePolling?: boolean; // Enable motion-based adaptive polling
}

interface MotionDetector {
  detect: (currentFrame: ImageData, previousFrame: ImageData | null) => number;
  hasSignificantMotion: (threshold?: number) => boolean;
}

/**
 * VeniceLiveProvider - Polling-based "live" session using Venice AI
 *
 * This provider simulates a live experience by:
 * 1. Capturing video frames at regular intervals (configurable pollingIntervalMs)
 * 2. Sending each frame to Venice's vision model for analysis
 * 3. Emitting reasoning events as if it were a real-time stream
 *
 * Trade-offs vs Gemini Live:
 * - Higher latency (bound by request-response cycle)
 * - No true bidirectional streaming
 * - No audio input support
 * - But: FREE to use (we provide the API key)
 */
export class VeniceLiveProvider {
  private client: OpenAI;
  private config: VeniceLiveConfig;
  private listeners: Record<string, ((data: unknown) => void)[]> = {};
  private isConnected = false;
  private frameCount = 0;
  private lastAnalysis = "";
  private previousFrameData: Uint8ClampedArray | null = null;
  private motionLevel = 0;

  // Goal-aware prompt templates for contextual analysis
  private readonly PROMPTS_BY_GOAL: Record<string, string[]> = {
    event: [
      "Analyze this outfit for a formal event. Focus on elegance, appropriateness, and sophistication.",
      "Evaluate if this look works for a special occasion. Check dress code alignment.",
      "Assess the silhouette and fit for evening wear standards.",
    ],
    daily: [
      "Analyze this everyday outfit. Focus on comfort, coordination, and practicality.",
      "Evaluate this casual look for daily wear. Check color harmony and balance.",
      "Assess the overall aesthetic for everyday style.",
    ],
    critique: [
      "Give an honest critique of this outfit. Be direct about what works and what doesn't.",
      "Analyze this look critically. Point out specific issues and strengths.",
      "Provide blunt fashion feedback. No sugarcoating.",
    ],
  };

  constructor(config: VeniceLiveConfig) {
    this.config = {
      pollingIntervalMs: 3000, // Default: poll every 3 seconds
      adaptivePolling: true, // Enable adaptive polling by default
      ...config,
    };
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || "https://api.venice.ai/api/v1",
    });
  }

  /**
   * Simple motion detection using frame difference
   * Returns a motion level between 0 (no motion) and 100 (max motion)
   */
  private detectMotion(currentFrameData: Uint8ClampedArray): number {
    const prevFrame = this.previousFrameData;
    if (!prevFrame) {
      this.previousFrameData = currentFrameData;
      return 50; // Initial assumption: moderate motion
    }

    let diff = 0;
    const sampleSize = Math.min(currentFrameData.length, prevFrame.length);
    const sampleStep = 16; // Sample every 16th pixel for performance

    for (let i = 0; i < sampleSize; i += sampleStep) {
      // Compare RGB values (skip alpha)
      if (i % 4 !== 3) {
        diff += Math.abs(currentFrameData[i]! - prevFrame[i]!);
      }
    }

    // Update previous frame
    this.previousFrameData = currentFrameData;

    // Normalize to 0-100 scale
    const maxDiff = (sampleSize / sampleStep) * (3 / 4) * 255; // Max possible diff
    const normalizedDiff = (diff / maxDiff) * 100;

    // Smooth the motion level
    this.motionLevel = this.motionLevel * 0.7 + normalizedDiff * 0.3;

    return Math.min(100, Math.max(0, this.motionLevel));
  }

  /**
   * Get adaptive polling interval based on motion level
   * - High motion (>30): Poll every 2 seconds (user is adjusting outfit)
   * - Medium motion (10-30): Poll every 3 seconds (normal)
   * - Low motion (<10): Poll every 5 seconds (user is still)
   */
  private getAdaptivePollingInterval(): number {
    if (!this.config.adaptivePolling) {
      return this.config.pollingIntervalMs ?? 3000;
    }

    if (this.motionLevel > 30) {
      return 2000; // High motion - faster polling
    } else if (this.motionLevel < 10) {
      return 5000; // Low motion - slower polling to save API calls
    }
    return this.config.pollingIntervalMs ?? 3000; // Default
  }

  /**
   * Creates a LiveSession that polls Venice's vision API
   */
  createSession(goal: string, systemInstruction?: string): LiveSession {
    const self = this;
    const goalKey = goal || "daily";
    const prompts =
      this.PROMPTS_BY_GOAL[goalKey] ?? this.PROMPTS_BY_GOAL.daily ?? [];
    let promptIndex = 0;

    const emit = (event: string, data: unknown) => {
      (self.listeners[event] ?? []).forEach((cb) => cb(data));
    };

    const analyzeFrame = async (
      imageData: string | Blob,
    ): Promise<string | null> => {
      try {
        // Convert blob to base64 if needed
        let base64Image: string;
        if (typeof imageData === "string") {
          base64Image = imageData.replace(/^data:image\/\w+;base64,/, "");
        } else {
          const buffer = await imageData.arrayBuffer();
          base64Image = Buffer.from(buffer).toString("base64");
        }

        const currentPrompt =
          prompts[promptIndex % prompts.length] ??
          "Analyze this outfit and provide styling feedback.";
        promptIndex++;

        const response = await self.client.chat.completions.create({
          model: "mistral-31-24b",
          messages: [
            {
              role: "system",
              content:
                systemInstruction ||
                self.config.systemInstruction ||
                "You are a fashion stylist AI analyzing video frames. Provide concise, actionable styling feedback. Keep responses under 100 words.",
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: currentPrompt,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/jpeg;base64,${base64Image}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 150,
          temperature: 0.7,
        });

        const analysis = response.choices[0]?.message?.content;
        if (analysis) {
          self.lastAnalysis = analysis;
          return analysis;
        }
        return null;
      } catch (error) {
        console.error("[VeniceLiveProvider] Analysis error:", error);
        return null;
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
        // Venice doesn't support audio streaming
        // Silently ignore - could emit a warning event if needed
      },

      sendImage: async (imageData: string | Blob) => {
        if (!self.isConnected) return;

        self.frameCount++;

        // Emit scanning indicator
        emit("reasoning", `Analyzing frame ${self.frameCount}...`);

        // Analyze the frame
        const analysis = await analyzeFrame(imageData);

        if (analysis) {
          // Parse analysis into reasoning chunks for the UI
          const chunks = analysis
            .split(/[.!?]+/)
            .filter((s) => s.trim().length > 5);

          // Emit each chunk with a slight delay to simulate "live" feeling
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

/**
 * Helper to create a Venice Live Provider with API key from environment
 */
export function createVeniceLiveProvider(
  apiKey?: string,
): VeniceLiveProvider | null {
  const key = apiKey || process.env.VENICE_API_KEY;
  if (!key) return null;

  return new VeniceLiveProvider({
    apiKey: key,
    pollingIntervalMs: 3000,
  });
}
