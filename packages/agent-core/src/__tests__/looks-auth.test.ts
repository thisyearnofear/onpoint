/**
 * Contract tests — looks SDK Bearer auth.
 *
 * createLook / updateLook / deleteLook require a signature-verified session
 * token (Authorization: Bearer) plus x-curator-slug for curator writes.
 * A bare x-agent-address header must never be sent.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchAgentApiMock = vi.fn();

vi.mock("../agent-api", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../agent-api")>();
  return {
    ...orig,
    fetchAgentApi: (...args: unknown[]) => fetchAgentApiMock(...args),
  };
});

import { createLook, updateLook, deleteLook } from "../looks-api";

function okJson(body: unknown) {
  return {
    ok: true,
    status: 201,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

beforeEach(() => {
  fetchAgentApiMock.mockReset();
});

describe("looks SDK session auth", () => {
  it("createLook sends Bearer + curator slug, never x-agent-address", async () => {
    fetchAgentApiMock.mockResolvedValue(okJson({ id: "1", slug: "t-ab12" }));
    await createLook(
      { title: "T", listingIds: ["a", "b"] },
      { token: "sess-token", curatorSlug: "nia" },
    );
    expect(fetchAgentApiMock).toHaveBeenCalledOnce();
    const [endpoint, init] = fetchAgentApiMock.mock.calls[0] as [string, RequestInit];
    expect(endpoint).toBe("/api/looks");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sess-token");
    expect(headers["x-curator-slug"]).toBe("nia");
    expect(headers).not.toHaveProperty("x-agent-address");
    expect(headers).not.toHaveProperty("x-curator-whatsapp");
  });

  it("updateLook sends Bearer headers", async () => {
    fetchAgentApiMock.mockResolvedValue(okJson({ id: "1", slug: "t-ab12", title: "T" }));
    await updateLook("t-ab12", { title: "T2" }, { token: "tok123" });
    const [, init] = fetchAgentApiMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok123");
    expect(headers).not.toHaveProperty("x-agent-address");
  });

  it("deleteLook sends Bearer headers", async () => {
    fetchAgentApiMock.mockResolvedValue(okJson({ success: true }));
    await deleteLook("t-ab12", { token: "tok123" });
    const [, init] = fetchAgentApiMock.mock.calls[0] as [string, RequestInit];
    const headers = (init.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok123");
  });
});
