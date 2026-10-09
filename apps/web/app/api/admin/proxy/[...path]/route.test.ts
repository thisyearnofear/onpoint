import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("SERVICE_API_KEY", "svc-key");
  vi.stubEnv("AGENT_API_URL", "https://api.example.test");
  fetchMock.mockReset().mockResolvedValue(
    new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } }),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function call(path: string[]) {
  const { GET } = await import("./route");
  const request = new NextRequest(`https://onpoint.test/api/admin/proxy/${path.join("/")}`);
  return GET(request, { params: Promise.resolve({ path }) });
}

describe("admin proxy path handling", () => {
  it("forwards a normal path under /api/admin with the service key", async () => {
    const res = await call(["curators", "nia", "listings"]);
    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).toBe("https://api.example.test/api/admin/curators/nia/listings");
    expect(init.headers["x-service-key"]).toBe("svc-key");
  });

  it.each([
    [[".."]],
    [["curators", "..", "..", "orders", "record"]],
    [["."]],
    [[""]],
    [["a/b"]],
    [["a\\b"]],
  ])("rejects a path that could escape /api/admin: %j", async (path) => {
    const res = await call(path as string[]);
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
