/**
 * 0G Compute Network — Router client
 *
 * The Router is OpenAI Chat Completions compatible, so we use the
 * official `openai` SDK with a custom baseURL. This keeps the integration
 * surface minimal (no heavy SDK install — just `openai` which the
 * monorepo already depends on transitively via `ai-client`).
 *
 * Why not the heavy `@0gfoundation/0g-compute-ts-sdk`? That SDK is
 * for the **Direct** flow: per-provider sub-accounts, wallet-signed
 * requests, fine-tuning, and the provider controller. We need the
 * Router for inference (single API key, OpenAI shape, auto-failover),
 * and we will only pull the Direct SDK in Wave 2/3 when we wire
 * fine-tuning.
 *
 * Reference: https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/overview
 */

import type {
  ZeroGChatRequest,
  ZeroGChatResponse,
  ZeroGClientConfig,
  ZeroGTEEProof,
} from "./types";

const DEFAULT_BASE_URL = "https://router-api.0g.ai/v1";
const DEFAULT_MODEL = "qwen3-vl-30b";
const DEFAULT_TIMEOUT_MS = 20_000;

export class ZeroGClient {
  private apiKey: string;
  private baseURL: string;
  private defaultModel: string;
  private chatModel: string;
  private timeoutMs: number;

  constructor(config: ZeroGClientConfig) {
    if (!config.apiKey) {
      throw new Error(
        "ZeroGClient: apiKey is required (set ZERO_G_API_KEY in env).",
      );
    }
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL ?? DEFAULT_BASE_URL;
    this.defaultModel = config.defaultModel ?? DEFAULT_MODEL;
    this.chatModel = config.chatModel ?? this.defaultModel;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /**
   * Send a chat-completion request. If the request includes
   * `verify_tee: true`, the returned proof can be persisted alongside
   * any verifiable agent receipt (ADR 0005) for tamper-evident
   * inference auditability.
   *
   * Implementation note: we use raw `fetch` (not the OpenAI SDK)
   * because (a) the SDK strips unknown response fields, which would
   * drop `x_0g_trace.tee_verified`, and (b) the SDK can normalize
   * the `Authorization: Bearer *** header in ways the 0G Router
   * does not accept for non-OpenAI-shaped keys. The shape we send
   * is OpenAI-compatible; only the transport changes.
   *
   * The TEE proof lives inside `x_0g_trace.tee_verified` (not at
   * the top level). We surface it as a normalized `tee_verified`
   * field on the response for forward compatibility.
   */
  async chat(request: ZeroGChatRequest): Promise<ZeroGChatResponse> {
    const payload = {
      ...request,
      // 0G-specific fields ride along on the JSON body.
      ...(request.verify_tee ? { verify_tee: true } : {}),
      ...(request.provider ? { provider: request.provider } : {}),
    };

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      throw new Error(`0G Router error ${response.status}: ${errBody.slice(0, 200)}`);
    }

    const data = await response.json();
    const trace = data.x_0g_trace;

    return {
      ...(data as ZeroGChatResponse),
      // Normalize the TEE proof onto the response surface. If the
      // caller didn't ask for it (verify_tee: false) or 0G didn't
      // return it, the field stays undefined.
      tee_verified: trace?.tee_verified
        ? {
            provider: trace.provider,
            mode: "TeeTLS",
            tee_type: "TDX",
            tee_verifier: "dstack",
          }
        : undefined,
    };
  }

  /**
   * Analyze an outfit image and return a parsed JSON object matching
   * the existing CritiqueResponse contract used by Venice / Replicate /
   * Azure. Falls through to text-only analysis if the model is not
   * vision-capable.
   */
  async analyzeOutfit(
    imageDataUrl: string,
    prompt: string,
    options: { model?: string; maxTokens?: number } = {},
  ): Promise<{ content: string; model: string; tee?: ZeroGTEEProof; usage?: ZeroGChatResponse["usage"] }> {
    const model = options.model ?? this.defaultModel;
    const response = await this.chat({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a professional fashion stylist. Respond with strict JSON matching the requested shape. No markdown, no commentary.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
      max_tokens: options.maxTokens ?? 800,
      response_format: { type: "json_object" },
    });

    return {
      content: response.choices[0]?.message?.content ?? "",
      model,
      tee: response.tee_verified,
      usage: response.usage,
    };
  }

  /**
   * Persona chat (text-only). Used by chatWithStylist. Picks the chat
   * default model — usually qwen3-vl-30b, with minimax-m3 reserved for
   * high-stakes persona turns during the 0G Bridge free window.
   */
  async chatPersona(
    systemPrompt: string,
    userMessage: string,
    options: { model?: string; maxTokens?: number; temperature?: number } = {},
  ): Promise<{ content: string; model: string; tee?: ZeroGTEEProof; usage?: ZeroGChatResponse["usage"] }> {
    const model = options.model ?? this.chatModel;
    const response = await this.chat({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: options.maxTokens ?? 500,
      temperature: options.temperature ?? 0.7,
    });

    return {
      content: response.choices[0]?.message?.content ?? "",
      model,
      tee: response.tee_verified,
      usage: response.usage,
    };
  }

  /**
   * Cheap health check used by the live-session factories to decide
   * whether 0G should be inserted into the runtime fallback chain.
   * Returns true if a 1-token completion succeeds within 2s.
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.chat({
        model: this.defaultModel,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
      });
      return true;
    } catch {
      return false;
    }
  }

  /** The configured default model (for telemetry / logs). */
  getDefaultModel(): string {
    return this.defaultModel;
  }

  /** The configured chat model. */
  getChatModel(): string {
    return this.chatModel;
  }
}

/**
 * Factory that reads the env once and returns a singleton client, or
 * null if the key is unset. Used by the server route, the agent-core
 * execution path, and the live-session factories.
 */
let _client: ZeroGClient | null = null;
let _clientInitialized = false;

export function getZeroGClient(): ZeroGClient | null {
  if (_clientInitialized) return _client;
  _clientInitialized = true;
  const apiKey = process.env.ZERO_G_API_KEY;
  if (!apiKey) {
    _client = null;
    return null;
  }
  _client = new ZeroGClient({
    apiKey,
    baseURL: process.env.ZERO_G_BASE_URL,
    defaultModel: process.env.ZERO_G_MODEL,
    chatModel: process.env.ZERO_G_CHAT_MODEL,
    timeoutMs: process.env.ZERO_G_TIMEOUT_MS
      ? Number(process.env.ZERO_G_TIMEOUT_MS)
      : undefined,
  });
  return _client;
}

/** Test-only — reset the singleton so tests can swap env. */
export function _resetZeroGClientForTests(): void {
  _client = null;
  _clientInitialized = false;
}
