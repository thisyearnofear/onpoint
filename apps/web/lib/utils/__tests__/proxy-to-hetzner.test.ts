import { describe, it, expect, vi, beforeEach } from "vitest";
import { proxyToHetzner } from "../proxy-to-hetzner";

beforeEach(() => {
  process.env.NEXT_PUBLIC_AGENT_API_URL = "https://api.example.test";
  process.env.VENICE_API_KEY = "test-key";
  vi.restoreAllMocks();
});

function req() {
  return new Request("https://app.test/api/ai/virtual-tryon", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "body-analysis" }),
  });
}

describe("proxyToHetzner graceful fallback", () => {
  it("converts upstream 502 into a clean retryable 503 (after retry)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("<html>502 Bad Gateway nginx</html>", { status: 502 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await proxyToHetzner(req(), "/api/ai/virtual-tryon", "veniceFree");
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.retryable).toBe(true);
    expect(json.error).toMatch(/temporarily unavailable/i);
    expect(fetchMock).toHaveBeenCalledTimes(2); // initial + 1 retry
  });

  it("returns 503 on network failure after retry", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    vi.stubGlobal("fetch", fetchMock);

    const res = await proxyToHetzner(req(), "/api/ai/virtual-tryon", "veniceFree");
    expect(res.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("passes through a successful 200 without retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await proxyToHetzner(req(), "/api/ai/virtual-tryon", "veniceFree");
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("passes through a meaningful 400 without masking", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ error: "bad input" }), { status: 400, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await proxyToHetzner(req(), "/api/ai/virtual-tryon", "veniceFree");
    expect(res.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
