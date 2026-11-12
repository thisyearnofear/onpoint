/**
 * Otari client + fallback chain — unit tests.
 *
 * No real API calls: fetch is stubbed per test.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  OtariClient,
  OtariAdminClient,
  OtariSpendGuardError,
  ChainAiClient,
  getPrimaryAiClient,
  getSandbaseClient,
  getOtariAdminClient,
  otariClientForAgentKey,
  parseCostUsd,
  fetchKeyUsageSummary,
  fetchKeyBudget,
  _resetOtariClientForTests,
  _resetSandbaseClientForTests,
  _resetOtariAdminForTests,
} from "../otari";
import { _resetQwenCloudClientForTests } from "../client";

function mockChatResponse(content = "ok") {
  return {
    ok: true,
    json: async () => ({
      id: "chatcmpl-test",
      model: "test/model",
      choices: [
        {
          index: 0,
          finish_reason: "stop",
          message: { role: "assistant", content },
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    }),
    text: async () => "",
  } as Response;
}

describe("OtariClient", () => {
  beforeEach(() => {
    _resetOtariClientForTests();
    _resetQwenCloudClientForTests();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    _resetOtariClientForTests();
    _resetQwenCloudClientForTests();
    vi.unstubAllGlobals();
  });

  it("throws if apiKey is missing", () => {
    expect(() => new OtariClient({ apiKey: "" })).toThrow("apiKey is required");
  });

  it("kill switch blocks all calls", async () => {
    const client = new OtariClient({ apiKey: "otk_test", killSwitch: true });
    await expect(
      client.chat({
        model: "vendor/model",
        messages: [{ role: "user", content: "test" }],
        max_tokens: 10,
      }),
    ).rejects.toThrow(OtariSpendGuardError);
  });

  it("posts OpenAI-compatible chat completions to the Otari base URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockChatResponse("hello"));
    vi.stubGlobal("fetch", fetchMock);

    const client = new OtariClient({
      apiKey: "otk_test",
      baseURL: "https://api.otari.ai/api/v1/",
      defaultChatModel: "vendor/chat-model",
    });

    const res = await client.chat({
      model: "vendor/chat-model",
      messages: [{ role: "user", content: "hi" }],
      max_tokens: 10,
      enable_thinking: false,
    });

    expect(res.choices[0]?.message?.content).toBe("hello");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.otari.ai/api/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer otk_test",
    );
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("vendor/chat-model");
    // Qwen-only fields are stripped
    expect(body.enable_thinking).toBeUndefined();
  });

  it("remaps bare Qwen-style model ids to the configured Otari model", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockChatResponse("{}"));
    vi.stubGlobal("fetch", fetchMock);

    const client = new OtariClient({
      apiKey: "otk_test",
      defaultVisionModel: "vendor/vl-model",
    });

    await client.analyzeOutfit("data:image/png;base64,AAAA", "prompt", {
      model: "qwen3-vl-flash", // legacy Qwen id — no "/" so it remaps
    });

    const body = JSON.parse(
      (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string,
    );
    expect(body.model).toBe("vendor/vl-model");
  });

  it("passes through Otari-format model ids", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockChatResponse("ok"));
    vi.stubGlobal("fetch", fetchMock);

    const client = new OtariClient({
      apiKey: "otk_test",
      defaultChatModel: "vendor/default",
    });
    await client.chatPersona("sys", "user", { model: "other/vendor-model" });

    const body = JSON.parse(
      (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string,
    );
    expect(body.model).toBe("other/vendor-model");
  });

  it("throws when no model is configured for the call type", async () => {
    const client = new OtariClient({ apiKey: "otk_test" });
    await expect(client.chatPersona("sys", "user")).rejects.toThrow(
      "no chat model configured",
    );
  });

  it("isAvailable returns false when kill-switched or unreachable", async () => {
    const killed = new OtariClient({
      apiKey: "otk_test",
      killSwitch: true,
      defaultChatModel: "vendor/model",
    });
    expect(await killed.isAvailable()).toBe(false);

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    const down = new OtariClient({
      apiKey: "otk_test",
      defaultChatModel: "vendor/model",
    });
    expect(await down.isAvailable()).toBe(false);
  });
});

describe("ChainAiClient", () => {
  it("falls through to the next client on failure", async () => {
    const failing = {
      provider: "otari",
      chatPersona: vi.fn().mockRejectedValue(new Error("insufficient credits")),
      isAvailable: vi.fn().mockResolvedValue(false),
    };
    const working = {
      provider: "qwen",
      chatPersona: vi
        .fn()
        .mockResolvedValue({
          content: "from-qwen",
          model: "m",
          estimatedCostUsd: 0,
        }),
      isAvailable: vi.fn().mockResolvedValue(true),
    };

    const chain = new ChainAiClient([failing as never, working as never]);
    const res = await chain.chatPersona("sys", "user");
    expect(res.content).toBe("from-qwen");
    expect(failing.chatPersona).toHaveBeenCalledOnce();
  });

  it("throws when every client fails", async () => {
    const a = {
      chatPersona: vi.fn().mockRejectedValue(new Error("a down")),
      isAvailable: vi.fn(),
    };
    const b = {
      chatPersona: vi.fn().mockRejectedValue(new Error("b down")),
      isAvailable: vi.fn(),
    };
    const chain = new ChainAiClient([a as never, b as never]);
    await expect(chain.chatPersona("s", "u")).rejects.toThrow(
      "All AI providers failed",
    );
  });
});

describe("getPrimaryAiClient", () => {
  const OLD_ENV = { ...process.env };

  beforeEach(() => {
    _resetOtariClientForTests();
    _resetSandbaseClientForTests();
    _resetQwenCloudClientForTests();
    delete process.env.SANDBASE_API_KEY;
  });

  afterEach(() => {
    process.env = { ...OLD_ENV };
    _resetOtariClientForTests();
    _resetSandbaseClientForTests();
    _resetQwenCloudClientForTests();
  });

  it("returns null when no AI keys are configured", () => {
    delete process.env.OTARI_API_KEY;
    delete process.env.DASHSCOPE_API_KEY;
    expect(getPrimaryAiClient()).toBeNull();
  });

  it("returns a chain with Otari first when both keys are set", () => {
    process.env.OTARI_API_KEY = "otk_test";
    process.env.OTARI_CHAT_MODEL = "vendor/chat";
    process.env.DASHSCOPE_API_KEY = "sk-test";
    const client = getPrimaryAiClient();
    expect(client).toBeInstanceOf(ChainAiClient);
    expect(client?.provider).toBe("chain");
  });

  it("returns the Otari client alone when only Otari is configured", () => {
    process.env.OTARI_API_KEY = "otk_test";
    process.env.OTARI_CHAT_MODEL = "vendor/chat";
    delete process.env.DASHSCOPE_API_KEY;
    const client = getPrimaryAiClient();
    expect(client).toBeInstanceOf(OtariClient);
  });

  it("puts Sandbase ahead of Otari for platform-funded spend", () => {
    process.env.SANDBASE_API_KEY = "sk_test";
    process.env.SANDBASE_CHAT_MODEL = "vendor/chat";
    process.env.OTARI_API_KEY = "otk_test";
    process.env.OTARI_CHAT_MODEL = "vendor/chat";
    const client = getPrimaryAiClient();
    expect(client).toBeInstanceOf(ChainAiClient);
    const chain = client as unknown as ChainAiClient;
    expect(chain.provider).toBe("chain");
    expect(getSandbaseClient()?.provider).toBe("sandbase");
    // A BYO agent key still routes to that agent's Otari workspace.
    expect(otariClientForAgentKey("otk_agent123")?.provider).toBe("otari");
  });
});

describe("parseCostUsd", () => {
  it("parses the Otari usage.cost_usd decimal string", () => {
    expect(
      parseCostUsd({
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
        cost_usd: "0.000044",
      }),
    ).toBe(0.000044);
  });

  it("returns null when the field is absent or unparsable", () => {
    expect(parseCostUsd(undefined)).toBeNull();
    expect(
      parseCostUsd({ prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }),
    ).toBeNull();
    expect(
      parseCostUsd({
        prompt_tokens: 1,
        completion_tokens: 1,
        total_tokens: 2,
        cost_usd: "n/a",
      }),
    ).toBeNull();
  });
});

describe("OtariClient cost reporting", () => {
  beforeEach(() => {
    _resetOtariClientForTests();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("surfaces usage.cost_usd as estimatedCostUsd on persona calls", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "chatcmpl-test",
        model: "vendor/chat",
        choices: [
          {
            index: 0,
            finish_reason: "stop",
            message: { role: "assistant", content: "hi" },
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
          cost_usd: "0.0001",
        },
      }),
      text: async () => "",
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const client = new OtariClient({
      apiKey: "otk_test",
      defaultChatModel: "vendor/chat",
    });
    const res = await client.chatPersona("sys", "user");
    expect(res.estimatedCostUsd).toBe(0.0001);
  });

  it("computes the Sandbase cost from model-card prices when usage carries none", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("/models/")
        ? ({
            ok: true,
            json: async () => ({
              model_card: {
                prompt_token_price: "0.30",
                completion_token_price: "1.20",
              },
            }),
          } as Response)
        : ({
            ok: true,
            json: async () => ({
              id: "chatcmpl-test",
              model: "vendor/chat",
              choices: [
                {
                  index: 0,
                  finish_reason: "stop",
                  message: { role: "assistant", content: "hi" },
                },
              ],
              usage: {
                prompt_tokens: 1_000_000,
                completion_tokens: 500_000,
                total_tokens: 1_500_000,
              },
            }),
            text: async () => "",
          } as Response),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new OtariClient({
      apiKey: "sk_test",
      providerName: "sandbase",
      defaultChatModel: "vendor/chat",
    });
    expect(client.provider).toBe("sandbase");
    const res = await client.chatPersona("sys", "user");
    // 1M prompt @ $0.30 + 500k completion @ $1.20
    expect(res.estimatedCostUsd).toBeCloseTo(0.9, 10);
    expect(fetchMock.mock.calls.map((c) => c[0])).toContain(
      "https://api.sandbase.ai/v1/models/vendor%2Fchat",
    );
  });

  it("reports zero cost when the model card prices are unreadable", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("/models/")
        ? ({ ok: false, status: 404 } as unknown as Response)
        : ({
            ok: true,
            json: async () => ({
              id: "chatcmpl-test",
              model: "vendor/priced",
              choices: [
                {
                  index: 0,
                  finish_reason: "stop",
                  message: { role: "assistant", content: "hi" },
                },
              ],
              usage: {
                prompt_tokens: 10,
                completion_tokens: 5,
                total_tokens: 15,
              },
            }),
            text: async () => "",
          } as Response),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new OtariClient({
      apiKey: "sk_test",
      providerName: "sandbase",
      defaultChatModel: "vendor/priced",
    });
    const res = await client.chatPersona("sys", "user");
    expect(res.estimatedCostUsd).toBe(0);
  });

  it("names the gateway in model-resolution errors", () => {
    const client = new OtariClient({
      apiKey: "sk_test",
      providerName: "sandbase",
    });
    expect(() => client["resolveModel"](undefined, "chat")).toThrow(
      "SandbaseClient: no chat model configured (set SANDBASE_CHAT_MODEL or SANDBASE_MODEL).",
    );
  });
});

describe("otariClientForAgentKey", () => {
  it("builds a client for a well-formed agent key", () => {
    const client = otariClientForAgentKey("otk_agent123");
    expect(client).toBeInstanceOf(OtariClient);
    expect(client?.provider).toBe("otari");
  });

  it("returns null for missing or malformed keys", () => {
    expect(otariClientForAgentKey(undefined)).toBeNull();
    expect(otariClientForAgentKey(null)).toBeNull();
    expect(otariClientForAgentKey("")).toBeNull();
    expect(otariClientForAgentKey("sk-not-an-otari-key")).toBeNull();
  });
});

describe("key usage + budget reads", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetchKeyUsageSummary hits /key/usage/summary with the caller's key", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ totals: { cost: 0.000044, total_tokens: 231 } }),
      text: async () => "",
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const summary = await fetchKeyUsageSummary("otk_agent", {
      baseURL: "https://eu.api.otari.ai/api/v1",
      params: { bucket: "day" },
    });
    expect(summary.totals?.cost).toBe(0.000044);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://eu.api.otari.ai/api/v1/key/usage/summary?bucket=day",
    );
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer otk_agent",
    );
  });

  it("fetchKeyBudget hits /key/budget", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        budgets_enforced: true,
        remaining_usd: null,
        limits: [],
      }),
      text: async () => "",
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const budget = await fetchKeyBudget("otk_agent", {
      baseURL: "https://eu.api.otari.ai/api/v1",
    });
    expect(budget.budgets_enforced).toBe(true);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("https://eu.api.otari.ai/api/v1/key/budget");
  });

  it("throws on non-OK responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({
          ok: false,
          status: 401,
          text: async () => "bad key",
        } as Response),
    );
    await expect(
      fetchKeyBudget("otk_bad", { baseURL: "https://x/v1" }),
    ).rejects.toThrow("Otari key budget error 401");
  });
});

describe("OtariAdminClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    _resetOtariAdminForTests();
  });

  it("requires a master key", () => {
    expect(() => new OtariAdminClient({ masterKey: "" })).toThrow(
      "masterKey is required",
    );
  });

  it("provisionAgentKey creates key, budget, and scoped budget in order", async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const fetchMock = vi
      .fn()
      .mockImplementation(async (url: string, init: RequestInit) => {
        calls.push({ url, body: JSON.parse(init.body as string) });
        const id = url.includes("/scoped-budgets")
          ? "sb_1"
          : url.includes("/budgets")
            ? "b_1"
            : "k_1";
        return {
          ok: true,
          json: async () => ({
            id,
            ...(url.endsWith("/keys") ? { key: "otk_new" } : {}),
          }),
          text: async () => "",
        } as Response;
      });
    vi.stubGlobal("fetch", fetchMock);

    const admin = new OtariAdminClient({
      masterKey: "master_1",
      baseURL: "https://eu.api.otari.ai/api/v1",
    });
    const provisioned = await admin.provisionAgentKey({
      agentId: "0xABC",
      maxBudgetUsd: 5,
      durationSeconds: 2592000,
    });

    expect(calls.map((c) => c.url)).toEqual([
      "https://eu.api.otari.ai/api/v1/keys",
      "https://eu.api.otari.ai/api/v1/budgets",
      "https://eu.api.otari.ai/api/v1/scoped-budgets",
    ]);
    expect(calls[0]!.body).toEqual({
      user_id: "0xABC",
      label: "onpoint-agent:0xABC",
    });
    expect(calls[1]!.body.max_budget).toBe(5);
    expect(calls[2]!.body).toEqual({
      scope_type: "api_token",
      scope_id: "k_1",
      budget_id: "b_1",
    });
    expect(provisioned.apiKey).toBe("otk_new");
  });

  it("getOtariAdminClient returns null without OTARI_ADMIN_KEY and a client with it", () => {
    delete process.env.OTARI_ADMIN_KEY;
    _resetOtariAdminForTests();
    expect(getOtariAdminClient()).toBeNull();

    process.env.OTARI_ADMIN_KEY = "master_x";
    _resetOtariAdminForTests();
    expect(getOtariAdminClient()).toBeInstanceOf(OtariAdminClient);
    delete process.env.OTARI_ADMIN_KEY;
  });
});
