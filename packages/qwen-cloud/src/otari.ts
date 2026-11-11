/**
 * Otari (Mozilla AI) — client
 *
 * Primary AI gateway for OnPoint (Dev Wilding hackathon). Otari is an
 * OpenAI-compatible LLM gateway: one workspace API key (`otk_…`) reaches
 * open-weight and frontier models at https://api.otari.ai/api/v1.
 *
 * Chat and vision calls go through Otari first; Qwen Cloud (DashScope)
 * remains as the fallback upstream via getPrimaryAiClient(). Image
 * generation stays on Qwen Cloud's AIGC endpoint unless OTARI_IMAGE_MODEL
 * is configured — Otari's image API is a separate surface.
 *
 * Model IDs are workspace-specific (visible in the otari.ai dashboard
 * Models tab, format `vendor/model`). Configure:
 *   OTARI_API_KEY        workspace key (otk_…)
 *   OTARI_BASE_URL       default https://api.otari.ai/api/v1
 *   OTARI_VISION_MODEL   vision model for analyzeOutfit etc.
 *   OTARI_CHAT_MODEL     text model for chatPersona etc.
 *   OTARI_IMAGE_MODEL    optional image-generation model
 *   OTARI_MODEL          generic fallback when the above are unset
 *   OTARI_KILL_SWITCH=1  disable all Otari calls
 *   OTARI_TIMEOUT_MS     per-request timeout (default 20s)
 *   OTARI_ADMIN_KEY      master key for key/budget provisioning
 *                        (OtariAdminClient — not needed for inference)
 *
 * Agent-metered keys (Dev Wilding differentiator): an agent can send
 * its own Otari key as `x-otari-key` on agent routes — its calls are
 * then metered and budget-capped in *its* Otari workspace, not ours.
 * Ops can mint per-agent keys with scoped budgets via OtariAdminClient
 * (`POST /keys` + `/budgets` + `/scoped-budgets`), and any key can
 * self-serve its own usage/budget via `/key/usage/summary` +
 * `/key/budget` — see fetchKeyUsageSummary / fetchKeyBudget.
 *
 * Otari also reports per-request server-side cost on every response
 * (`usage.cost_usd`) — surfaced as `estimatedCostUsd` on results and
 * as `aiCost` on API responses, so agents see what the model call
 * actually cost, not an estimate.
 *
 * Callers may pass Qwen-style model ids (e.g. "qwen3-vl-flash") for
 * backward compatibility — they are remapped to the configured Otari
 * models. Otari-format ids (containing "/" or ":") pass through.
 *
 * Docs: https://docs.otari.ai/getting-started/quickstart
 */

import type {
  QwenCloudAnalysisResult,
  QwenCloudChatRequest,
  QwenCloudChatResponse,
  QwenCloudChatResult,
  QwenCloudImageGenerationOptions,
  QwenCloudImageResult,
} from "./types";
import { getQwenCloudClient, QwenCloudClient } from "./client";

const DEFAULT_BASE_URL = "https://api.otari.ai/api/v1";
const DEFAULT_TIMEOUT_MS = 20_000;

/** Hard max_tokens ceilings per call type — spend control. */
const MAX_TOKENS_CEILINGS = {
  analysis: 300,
  africanTextile: 400,
  persona: 500,
  healthCheck: 1,
} as const;

/**
 * Read the server-side USD cost Otari stamps on each response
 * (`usage.cost_usd`, a decimal string). Returns null when the
 * field is absent (non-Otari upstreams) or unparsable.
 */
export function parseCostUsd(
  usage: QwenCloudChatResponse["usage"] | undefined,
): number | null {
  if (!usage?.cost_usd) return null;
  const cost = Number(usage.cost_usd);
  return Number.isFinite(cost) ? cost : null;
}

export interface OtariClientConfig {
  apiKey: string;
  baseURL?: string;
  defaultVisionModel?: string;
  defaultChatModel?: string;
  defaultImageModel?: string;
  /** Generic model used when a call-type model is unset. */
  defaultModel?: string;
  timeoutMs?: number;
  killSwitch?: boolean;
}

/** Error thrown when a spend control blocks a call. */
export class OtariSpendGuardError extends Error {
  constructor(public readonly reason: "kill_switch") {
    super("Otari kill switch is active (OTARI_KILL_SWITCH=1)");
    this.name = "OtariSpendGuardError";
  }
}

export class OtariClient {
  readonly provider = "otari" as const;

  private apiKey: string;
  private baseURL: string;
  private defaultVisionModel?: string;
  private defaultChatModel?: string;
  private defaultImageModel?: string;
  private defaultModel?: string;
  private timeoutMs: number;
  private killSwitch: boolean;

  constructor(config: OtariClientConfig) {
    if (!config.apiKey) {
      throw new Error("OtariClient: apiKey is required (set OTARI_API_KEY in env).");
    }
    this.apiKey = config.apiKey;
    this.baseURL = (config.baseURL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.defaultVisionModel = config.defaultVisionModel;
    this.defaultChatModel = config.defaultChatModel;
    this.defaultImageModel = config.defaultImageModel;
    this.defaultModel = config.defaultModel;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.killSwitch = config.killSwitch ?? false;
  }

  /**
   * Resolve the model for a call. Caller-supplied Otari-format ids
   * (containing "/" or ":") pass through; bare ids (e.g. legacy Qwen
   * model names) are remapped to the configured default for the call
   * type so stale callers keep working.
   */
  private resolveModel(
    requested: string | undefined,
    callType: "vision" | "chat" | "image",
  ): string {
    if (requested && /[/.:]/.test(requested)) return requested;
    const configured =
      callType === "vision"
        ? this.defaultVisionModel
        : callType === "image"
          ? this.defaultImageModel
          : this.defaultChatModel;
    const model = configured ?? this.defaultModel;
    if (!model) {
      throw new Error(
        `OtariClient: no ${callType} model configured (set OTARI_${callType.toUpperCase()}_MODEL or OTARI_MODEL).`,
      );
    }
    return model;
  }

  // ── Core API call ─────────────────────────────────────────────

  /**
   * Send a chat-completion request to Otari.
   * The API is OpenAI-compatible; Qwen-specific fields are stripped.
   */
  async chat(request: QwenCloudChatRequest): Promise<QwenCloudChatResponse> {
    if (this.killSwitch) {
      throw new OtariSpendGuardError("kill_switch");
    }

    // Strip Qwen-only fields Otari won't understand.
    const { enable_thinking: _omit, ...rest } = request;

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(rest),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      throw new Error(
        `Otari error ${response.status}: ${errBody.slice(0, 300)}`,
      );
    }

    return (await response.json()) as QwenCloudChatResponse;
  }

  // ── High-level methods (same contract as QwenCloudClient) ─────

  /**
   * Analyze an outfit image and return a parsed JSON object matching
   * the existing CritiqueResponse contract used by Venice / 0G /
   * Replicate / Qwen Cloud.
   */
  async analyzeOutfit(
    imageDataUrl: string,
    prompt: string,
    options: { model?: string; maxTokens?: number } = {},
  ): Promise<QwenCloudAnalysisResult> {
    const model = this.resolveModel(options.model, "vision");
    const maxTokens = Math.min(
      options.maxTokens ?? 200,
      MAX_TOKENS_CEILINGS.analysis,
    );

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
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    });

    return {
      content: response.choices[0]?.message?.content ?? "",
      model,
      usage: response.usage,
      // Otari reports the settled server-side cost per request.
      estimatedCostUsd: parseCostUsd(response.usage) ?? 0,
    };
  }

  /**
   * Specialized African textile pattern identification — the
   * differentiated capability. Same contract as QwenCloudClient.
   */
  async analyzeAfricanTextile(
    imageDataUrl: string,
    options: { model?: string; maxTokens?: number } = {},
  ): Promise<QwenCloudAnalysisResult> {
    const model = this.resolveModel(options.model, "vision");
    const maxTokens = Math.min(
      options.maxTokens ?? 300,
      MAX_TOKENS_CEILINGS.africanTextile,
    );

    const prompt = `Identify any African textile patterns in this outfit. Respond as strict JSON with this shape:
{
  "patterns": [
    {
      "name": "Ankara | Kente | Adire | Bogolan | Shweshwe | Kitenge | Wax Print | Other",
      "confidence": 0.0-1.0,
      "region": "West Africa | East Africa | Central Africa | Southern Africa | North Africa | Unknown",
      "culturalContext": "brief context"
    }
  ],
  "occasionAppropriateness": "casual | semi-formal | formal | ceremonial | everyday",
  "stylingNotes": "brief notes on how the pattern is integrated",
  "overallAssessment": "one-sentence summary"
}
If no African textile patterns are present, return { "patterns": [], "overallAssessment": "No African textile patterns identified." }`;

    const response = await this.chat({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are an expert in African fashion and textile history. Respond with strict JSON. No markdown.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    });

    return {
      content: response.choices[0]?.message?.content ?? "",
      model,
      usage: response.usage,
      estimatedCostUsd: parseCostUsd(response.usage) ?? 0,
    };
  }

  /**
   * Persona chat (text-only). Same contract as QwenCloudClient.
   */
  async chatPersona(
    systemPrompt: string,
    userMessage: string,
    options: { model?: string; maxTokens?: number; temperature?: number } = {},
  ): Promise<QwenCloudChatResult> {
    const model = this.resolveModel(options.model, "chat");
    const maxTokens = Math.min(
      options.maxTokens ?? 400,
      MAX_TOKENS_CEILINGS.persona,
    );

    const response = await this.chat({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: maxTokens,
      temperature: options.temperature ?? 0.7,
    });

    return {
      content: response.choices[0]?.message?.content ?? "",
      model,
      usage: response.usage,
      estimatedCostUsd: parseCostUsd(response.usage) ?? 0,
    };
  }

  /**
   * Generate an image. Uses Otari's OpenAI-compatible /images/generations
   * endpoint when OTARI_IMAGE_MODEL is configured; otherwise delegates
   * to Qwen Cloud's AIGC image endpoint (which remains the image-gen
   * upstream). Throws when neither is available.
   */
  async generateImage(
    prompt: string,
    inputImages: string[] = [],
    options: QwenCloudImageGenerationOptions = {},
  ): Promise<QwenCloudImageResult> {
    if (this.defaultImageModel) {
      return this.generateImageViaOtari(prompt, options);
    }

    const qwen = getQwenCloudClient();
    if (qwen) {
      return qwen.generateImage(prompt, inputImages, options);
    }

    throw new Error(
      "OtariClient.generateImage: no OTARI_IMAGE_MODEL and no Qwen Cloud fallback configured.",
    );
  }

  /** OpenAI-compatible image generation through Otari. */
  private async generateImageViaOtari(
    prompt: string,
    options: QwenCloudImageGenerationOptions,
  ): Promise<QwenCloudImageResult> {
    if (this.killSwitch) {
      throw new OtariSpendGuardError("kill_switch");
    }

    const n = Math.max(1, Math.min(options.n ?? 1, 4));
    const size = options.size ?? "1024x1024";

    const response = await fetch(`${this.baseURL}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.defaultImageModel,
        prompt,
        size,
        n,
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      throw new Error(
        `Otari image generation error ${response.status}: ${errBody.slice(0, 300)}`,
      );
    }

    const data = (await response.json()) as {
      data?: Array<{ url?: string; b64_json?: string }>;
      usage?: QwenCloudChatResponse["usage"];
    };

    const urls = (data.data ?? [])
      .map((d) => d.url)
      .filter((u): u is string => typeof u === "string" && u.length > 0);

    if (urls.length === 0) {
      throw new Error("Otari image generation returned no image URLs");
    }

    return {
      urls,
      model: this.defaultImageModel as string,
      estimatedCostUsd: parseCostUsd(data.usage) ?? 0,
    };
  }

  /**
   * Cheap health check — 1-token completion. Returns false on any
   * failure so callers can fall back to Qwen Cloud.
   */
  async isAvailable(): Promise<boolean> {
    try {
      if (this.killSwitch) return false;
      // Probe with the chat model; if only a vision model is
      // configured, probe that instead.
      const probe =
        this.defaultChatModel ?? this.defaultModel ?? this.defaultVisionModel;
      if (!probe) return false;
      await this.chat({
        model: probe,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: MAX_TOKENS_CEILINGS.healthCheck,
      });
      return true;
    } catch {
      return false;
    }
  }

  getDefaultVisionModel(): string | undefined {
    return this.defaultVisionModel ?? this.defaultModel;
  }

  getDefaultChatModel(): string | undefined {
    return this.defaultChatModel ?? this.defaultModel;
  }

  getDefaultImageModel(): string | undefined {
    return this.defaultImageModel;
  }
}

// ── Singleton factories ─────────────────────────────────────────

let _otariClient: OtariClient | null = null;
let _otariInitialized = false;

/**
 * Otari client singleton, or null when OTARI_API_KEY is unset.
 * Model IDs come from OTARI_VISION_MODEL / OTARI_CHAT_MODEL /
 * OTARI_IMAGE_MODEL / OTARI_MODEL — pick them from the workspace
 * Models tab in the otari.ai dashboard.
 */
export function getOtariClient(): OtariClient | null {
  if (_otariInitialized) return _otariClient;
  _otariInitialized = true;
  const apiKey = process.env.OTARI_API_KEY;
  if (!apiKey || apiKey.startsWith("your_")) {
    _otariClient = null;
    return null;
  }
  _otariClient = new OtariClient({
    apiKey,
    baseURL: process.env.OTARI_BASE_URL,
    defaultVisionModel: process.env.OTARI_VISION_MODEL,
    defaultChatModel: process.env.OTARI_CHAT_MODEL,
    defaultImageModel: process.env.OTARI_IMAGE_MODEL,
    defaultModel: process.env.OTARI_MODEL,
    timeoutMs: process.env.OTARI_TIMEOUT_MS
      ? Number(process.env.OTARI_TIMEOUT_MS)
      : undefined,
    killSwitch: process.env.OTARI_KILL_SWITCH === "1",
  });
  return _otariClient;
}

/** Test-only — reset the singleton so tests can swap env. */
export function _resetOtariClientForTests(): void {
  _otariClient = null;
  _otariInitialized = false;
}

export type PrimaryAiClient = OtariClient | QwenCloudClient | ChainAiClient;

/**
 * Ordered fallback chain: Otari first, Qwen Cloud second. Each call
 * tries providers in order and falls through on any error — this is
 * what makes Qwen/DashScope "secondary, when Otari credits are
 * unavailable" rather than just unconfigured.
 */
export class ChainAiClient {
  readonly provider = "chain" as const;

  constructor(private readonly clients: PrimaryAiClient[]) {}

  private async first<T>(
    method: keyof OtariClient & keyof QwenCloudClient,
    args: unknown[],
  ): Promise<T> {
    const errors: string[] = [];
    for (const client of this.clients) {
      try {
        const fn = (client as unknown as Record<string, (...a: unknown[]) => Promise<T>>)[
          method as string
        ];
        if (typeof fn !== "function") continue;
        return await fn.apply(client, args);
      } catch (err) {
        errors.push(
          `${(client as { provider?: string }).provider ?? "unknown"}: ${(err as Error).message}`,
        );
      }
    }
    throw new Error(`All AI providers failed (${errors.join("; ") || "none configured"})`);
  }

  chat(request: QwenCloudChatRequest) {
    return this.first<QwenCloudChatResponse>("chat", [request]);
  }

  analyzeOutfit(imageDataUrl: string, prompt: string, options = {}) {
    return this.first<QwenCloudAnalysisResult>("analyzeOutfit", [
      imageDataUrl,
      prompt,
      options,
    ]);
  }

  analyzeAfricanTextile(imageDataUrl: string, options = {}) {
    return this.first<QwenCloudAnalysisResult>("analyzeAfricanTextile", [
      imageDataUrl,
      options,
    ]);
  }

  chatPersona(systemPrompt: string, userMessage: string, options = {}) {
    return this.first<QwenCloudChatResult>("chatPersona", [
      systemPrompt,
      userMessage,
      options,
    ]);
  }

  generateImage(prompt: string, inputImages: string[] = [], options = {}) {
    return this.first<QwenCloudImageResult>("generateImage", [
      prompt,
      inputImages,
      options,
    ]);
  }

  /** True when at least one upstream is reachable. */
  async isAvailable(): Promise<boolean> {
    for (const client of this.clients) {
      try {
        if (await client.isAvailable()) return true;
      } catch {
        // try next
      }
    }
    return false;
  }

  getDefaultVisionModel(): string | undefined {
    return this.clients[0]?.getDefaultVisionModel();
  }

  getDefaultChatModel(): string | undefined {
    return this.clients[0]?.getDefaultChatModel();
  }

  getDefaultImageModel(): string | undefined {
    return this.clients[0]?.getDefaultImageModel();
  }
}

/**
 * The primary AI client for OnPoint: Otari when configured, Qwen
 * Cloud otherwise — and when both are configured, a fallback chain
 * that tries Otari first and Qwen Cloud on any failure (credits
 * exhausted, model unavailable, timeout). All expose the same call
 * surface (chat/analyzeOutfit/chatPersona/analyzeAfricanTextile/
 * generateImage/isAvailable).
 */
export function getPrimaryAiClient(): PrimaryAiClient | null {
  const otari = getOtariClient();
  const qwen = getQwenCloudClient();
  const clients = [otari, qwen].filter(
    (c): c is OtariClient | QwenCloudClient => c !== null,
  );
  if (clients.length === 0) return null;
  if (clients.length === 1) return clients[0]!;
  return new ChainAiClient(clients);
}

// ── Agent-metered keys (BYO Otari key) ──────────────────────────

/**
 * Build an OtariClient for an agent-supplied key (the `x-otari-key`
 * header on agent routes). Model defaults come from the process env —
 * the key only changes whose workspace the calls are metered and
 * budget-capped against, not which models are used.
 *
 * Returns null for missing/malformed keys so callers can ignore the
 * header instead of failing the request.
 */
export function otariClientForAgentKey(
  apiKey: string | undefined | null,
): OtariClient | null {
  if (!apiKey || !apiKey.startsWith("otk_")) return null;
  return new OtariClient({
    apiKey,
    baseURL: process.env.OTARI_BASE_URL,
    defaultVisionModel: process.env.OTARI_VISION_MODEL,
    defaultChatModel: process.env.OTARI_CHAT_MODEL,
    defaultImageModel: process.env.OTARI_IMAGE_MODEL,
    defaultModel: process.env.OTARI_MODEL,
    timeoutMs: process.env.OTARI_TIMEOUT_MS
      ? Number(process.env.OTARI_TIMEOUT_MS)
      : undefined,
    // Agent keys are not subject to our kill switch — their workspace
    // enforces its own budgets.
    killSwitch: false,
  });
}

// ── Self-serve key usage + budget (any key can call these) ──────

export interface OtariKeyUsageSummary {
  start_date?: string;
  end_date?: string;
  bucket?: string;
  totals?: {
    cost?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    requests?: number;
  };
  [key: string]: unknown;
}

export interface OtariKeyBudget {
  budgets_enforced?: boolean;
  remaining_usd?: number | null;
  limits?: Array<{
    budget_id?: string;
    max_budget?: number;
    spent?: number;
    remaining?: number;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

function otariBaseURL(override?: string): string {
  return (override ?? process.env.OTARI_BASE_URL ?? DEFAULT_BASE_URL).replace(
    /\/$/,
    "",
  );
}

/**
 * GET /key/usage/summary — any Otari key can read its own usage.
 * `params` are forwarded as query args (e.g. start_date, end_date,
 * bucket).
 */
export async function fetchKeyUsageSummary(
  apiKey: string,
  options: { baseURL?: string; params?: Record<string, string> } = {},
): Promise<OtariKeyUsageSummary> {
  const qs = options.params
    ? `?${new URLSearchParams(options.params).toString()}`
    : "";
  const response = await fetch(
    `${otariBaseURL(options.baseURL)}/key/usage/summary${qs}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(
      `Otari usage summary error ${response.status}: ${errBody.slice(0, 300)}`,
    );
  }
  return (await response.json()) as OtariKeyUsageSummary;
}

/**
 * GET /key/budget — any Otari key can read the budgets enforced on it
 * (scoped budgets attached by the workspace operator).
 */
export async function fetchKeyBudget(
  apiKey: string,
  options: { baseURL?: string } = {},
): Promise<OtariKeyBudget> {
  const response = await fetch(`${otariBaseURL(options.baseURL)}/key/budget`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(
      `Otari key budget error ${response.status}: ${errBody.slice(0, 300)}`,
    );
  }
  return (await response.json()) as OtariKeyBudget;
}

// ── Admin client — key + scoped-budget provisioning ─────────────
//
// Provisioning (POST /keys, /budgets, /scoped-budgets) requires a
// master key on the deployment — regular otk_ inference keys get
// 401 "Invalid master key". On self-hosted Otari that's the operator
// master key; set it as OTARI_ADMIN_KEY. On hosted otari.ai, mint
// per-agent keys in the dashboard instead — inference and usage
// readback work the same either way.

export interface OtariProvisionedKey {
  keyId: string;
  /** The raw key — returned once at creation time. */
  apiKey: string;
  budgetId?: string;
  scopedBudgetId?: string;
}

export class OtariAdminClient {
  private masterKey: string;
  private baseURL: string;
  private timeoutMs: number;

  constructor(config: { masterKey: string; baseURL?: string; timeoutMs?: number }) {
    if (!config.masterKey) {
      throw new Error("OtariAdminClient: masterKey is required (set OTARI_ADMIN_KEY).");
    }
    this.masterKey = config.masterKey;
    this.baseURL = otariBaseURL(config.baseURL);
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const response = await fetch(`${this.baseURL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.masterKey}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      throw new Error(
        `Otari admin ${method} ${path} error ${response.status}: ${errBody.slice(0, 300)}`,
      );
    }
    return (await response.json()) as T;
  }

  /** POST /keys — mint a new workspace API key for an agent. */
  async createKey(input: {
    userId: string;
    label?: string;
  }): Promise<{ id: string; key: string; [k: string]: unknown }> {
    return this.request("POST", "/keys", {
      user_id: input.userId,
      ...(input.label ? { label: input.label } : {}),
    });
  }

  /** POST /budgets — define a spend cap. */
  async createBudget(input: {
    maxBudgetUsd: number;
    durationSeconds?: number;
    label?: string;
  }): Promise<{ id: string; [k: string]: unknown }> {
    return this.request("POST", "/budgets", {
      max_budget: input.maxBudgetUsd,
      ...(input.durationSeconds
        ? { duration_seconds: input.durationSeconds }
        : {}),
      ...(input.label ? { label: input.label } : {}),
    });
  }

  /** POST /scoped-budgets — attach a budget to a specific key. */
  async attachScopedBudget(input: {
    keyId: string;
    budgetId: string;
  }): Promise<{ id: string; [k: string]: unknown }> {
    return this.request("POST", "/scoped-budgets", {
      scope_type: "api_token",
      scope_id: input.keyId,
      budget_id: input.budgetId,
    });
  }

  /**
   * Provision a per-agent key with a hard spend cap in one call:
   * create the key, create the budget, attach it. The returned
   * apiKey is shown once — persist it before discarding.
   */
  async provisionAgentKey(input: {
    agentId: string;
    maxBudgetUsd: number;
    durationSeconds?: number;
  }): Promise<OtariProvisionedKey> {
    const key = await this.createKey({
      userId: input.agentId,
      label: `onpoint-agent:${input.agentId}`,
    });
    const budget = await this.createBudget({
      maxBudgetUsd: input.maxBudgetUsd,
      durationSeconds: input.durationSeconds,
      label: `onpoint-agent:${input.agentId}`,
    });
    const scoped = await this.attachScopedBudget({
      keyId: key.id,
      budgetId: budget.id,
    });
    return {
      keyId: key.id,
      apiKey: key.key,
      budgetId: budget.id,
      scopedBudgetId: scoped.id,
    };
  }
}

let _otariAdmin: OtariAdminClient | null = null;
let _otariAdminInitialized = false;

/**
 * Admin client singleton, or null when OTARI_ADMIN_KEY is unset.
 * Inference never needs this — only key/budget provisioning does.
 */
export function getOtariAdminClient(): OtariAdminClient | null {
  if (_otariAdminInitialized) return _otariAdmin;
  _otariAdminInitialized = true;
  const masterKey = process.env.OTARI_ADMIN_KEY;
  if (!masterKey) {
    _otariAdmin = null;
    return null;
  }
  _otariAdmin = new OtariAdminClient({
    masterKey,
    baseURL: process.env.OTARI_BASE_URL,
    timeoutMs: process.env.OTARI_TIMEOUT_MS
      ? Number(process.env.OTARI_TIMEOUT_MS)
      : undefined,
  });
  return _otariAdmin;
}

/** Test-only — reset the admin singleton. */
export function _resetOtariAdminForTests(): void {
  _otariAdmin = null;
  _otariAdminInitialized = false;
}
