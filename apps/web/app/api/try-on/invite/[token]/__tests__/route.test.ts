import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { POST } from "../route";
import { createInviteToken } from "@/lib/utils/try-on-invite";

const TOKEN = createInviteToken({ curatorSlug: "nia", listingId: "l9" });
const BODY = JSON.stringify({ photoData: "data:image/png;base64,AA==" });
const REQ = { json: async () => JSON.parse(BODY) };
const PARAMS = { params: Promise.resolve({ token: TOKEN }) };

const fetchMock = vi.fn();

/** consume → (release?) → upstream render */
function mockUpstream({ consume = 200, upstream = 200 }: { consume?: number; upstream?: number | null } = {}) {
  fetchMock.mockImplementation(async (url: string) => {
    if (String(url).includes("/api/invites/consume")) {
      return { status: consume, json: async () => ({}) } as unknown as Response;
    }
    if (String(url).includes("/api/invites/release")) {
      return { status: 200, json: async () => ({}) } as unknown as Response;
    }
    if (upstream === null) throw new Error("down");
    return {
      ok: upstream >= 200 && upstream < 300,
      status: upstream,
      text: async () => "{}",
      headers: { get: () => "application/json" },
    } as unknown as Response;
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("invite render — single-use claim", () => {
  it("claims the token before rendering", async () => {
    mockUpstream();
    const res = await POST(REQ as never, PARAMS as never);
    expect(res.status).toBe(200);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/invites/consume");
    expect(String(fetchMock.mock.calls[1][0])).toContain("/api/ai/virtual-tryon");
  });

  it("answers 410 without rendering when the link is spent", async () => {
    mockUpstream({ consume: 409 });
    const res = await POST(REQ as never, PARAMS as never);
    expect(res.status).toBe(410);
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("/api/ai/virtual-tryon"))).toBe(false);
  });

  it("gives the claim back when the render fails so a retry works", async () => {
    mockUpstream({ upstream: 500 });
    const res = await POST(REQ as never, PARAMS as never);
    expect(res.status).toBe(500);
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("/api/invites/release"))).toBe(true);
  });
});
