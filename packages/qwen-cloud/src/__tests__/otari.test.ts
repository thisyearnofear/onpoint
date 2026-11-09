/**
 * Otari client + fallback chain — unit tests.
 *
 * No real API calls: fetch is stubbed per test.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  OtariClient,
  OtariSpendGuardError,
  ChainAiClient,
  getPrimaryAiClient,
  _resetOtariClientForTests,
} from "../otari";
import { _resetQwenCloudClientForTests } from "../client";

function mockChatResponse(content = "ok") {
  return {
    ok: true,
    json: async () => ({
      id: "chatcmpl-test",
      model: "test/model",
      choices: [
        { index: 0, finish_reason: "stop", message: { role: "assistant", content } },
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
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer otk_test");
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

    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.model).toBe("vendor/vl-model");
  });

  it("passes through Otari-format model ids", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockChatResponse("ok"));
    vi.stubGlobal("fetch", fetchMock);

    const client = new OtariClient({ apiKey: "otk_test", defaultChatModel: "vendor/default" });
    await client.chatPersona("sys", "user", { model: "other/vendor-model" });

    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.model).toBe("other/vendor-model");
  });

  it("throws when no model is configured for the call type", async () => {
    const client = new OtariClient({ apiKey: "otk_test" });
    await expect(
      client.chatPersona("sys", "user"),
    ).rejects.toThrow("no chat model configured");
  });

  it("isAvailable returns false when kill-switched or unreachable", async () => {
    const killed = new OtariClient({
      apiKey: "otk_test",
      killSwitch: true,
      defaultChatModel: "vendor/model",
    });
    expect(await killed.isAvailable()).toBe(false);

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    const down = new OtariClient({ apiKey: "otk_test", defaultChatModel: "vendor/model" });
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
      chatPersona: vi.fn().mockResolvedValue({ content: "from-qwen", model: "m", estimatedCostUsd: 0 }),
      isAvailable: vi.fn().mockResolvedValue(true),
    };

    const chain = new ChainAiClient([failing as never, working as never]);
    const res = await chain.chatPersona("sys", "user");
    expect(res.content).toBe("from-qwen");
    expect(failing.chatPersona).toHaveBeenCalledOnce();
  });

  it("throws when every client fails", async () => {
    const a = { chatPersona: vi.fn().mockRejectedValue(new Error("a down")), isAvailable: vi.fn() };
    const b = { chatPersona: vi.fn().mockRejectedValue(new Error("b down")), isAvailable: vi.fn() };
    const chain = new ChainAiClient([a as never, b as never]);
    await expect(chain.chatPersona("s", "u")).rejects.toThrow("All AI providers failed");
  });
});

describe("getPrimaryAiClient", () => {
  const OLD_ENV = { ...process.env };

  beforeEach(() => {
    _resetOtariClientForTests();
    _resetQwenCloudClientForTests();
  });

  afterEach(() => {
    process.env = { ...OLD_ENV };
    _resetOtariClientForTests();
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
});
