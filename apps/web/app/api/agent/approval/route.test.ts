import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApprovalRequest: vi.fn(),
  getPendingApprovals: vi.fn(),
  createApprovalRequest: vi.fn(),
  approveRequest: vi.fn(),
  rejectRequest: vi.fn(),
  initStore: vi.fn(),
}));

vi.mock("../../../../lib/middleware/agent-controls", () => ({
  AgentControls: {
    initStore: mocks.initStore,
    getApprovalRequest: mocks.getApprovalRequest,
    getPendingApprovals: mocks.getPendingApprovals,
    createApprovalRequest: mocks.createApprovalRequest,
    approveRequest: mocks.approveRequest,
    rejectRequest: mocks.rejectRequest,
  },
}));

vi.mock("../../../../middleware/agent-auth", () => ({
  requireAuthWithRateLimit:
    (handler: Function) => (req: NextRequest) =>
      handler(req, { userId: "user1", agentId: "onpoint-stylist", tier: "premium", permissions: [] }),
}));

describe("GET /api/agent/approval", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns pending approvals list", async () => {
    mocks.getPendingApprovals.mockReturnValue([{ id: "apr_1", status: "pending" }]);

    const { GET } = await import("./route");
    const res = await GET(new NextRequest("http://localhost/api/agent/approval"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.requests).toHaveLength(1);
  });

  it("returns specific approval by id", async () => {
    mocks.getApprovalRequest.mockReturnValue({ id: "apr_1", agentId: "onpoint-stylist", status: "pending" });

    const { GET } = await import("./route");
    const res = await GET(new NextRequest("http://localhost/api/agent/approval?id=apr_1"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.request.id).toBe("apr_1");
  });

  it("returns 404 for unknown approval", async () => {
    mocks.getApprovalRequest.mockReturnValue(null);

    const { GET } = await import("./route");
    const res = await GET(new NextRequest("http://localhost/api/agent/approval?id=nope"));
    expect(res.status).toBe(404);
  });
});

describe("POST /api/agent/approval", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates an approval request", async () => {
    mocks.createApprovalRequest.mockReturnValue({
      id: "apr_1", status: "pending", amount: "5 cUSD", description: "Test", expiresAt: Date.now() + 300000,
    });

    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/agent/approval", {
        method: "POST",
        body: JSON.stringify({ actionType: "purchase", amount: "5 cUSD", description: "Buy shirt" }),
      }),
    );
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.request.id).toBe("apr_1");
  });

  it("rejects invalid body", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/agent/approval", {
        method: "POST",
        body: JSON.stringify({ actionType: "invalid_type" }),
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/agent/approval", () => {
  beforeEach(() => vi.clearAllMocks());

  it("approves a request", async () => {
    mocks.approveRequest.mockReturnValue(true);
    mocks.getApprovalRequest.mockReturnValue({ id: "apr_1", status: "approved" });

    const { PATCH } = await import("./route");
    const res = await PATCH(
      new NextRequest("http://localhost/api/agent/approval", {
        method: "PATCH",
        body: JSON.stringify({ id: "apr_1", action: "approve" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(mocks.approveRequest).toHaveBeenCalledWith("apr_1", "user1");
  });

  it("rejects a request", async () => {
    mocks.rejectRequest.mockReturnValue(true);
    mocks.getApprovalRequest.mockReturnValue({ id: "apr_1", status: "rejected" });

    const { PATCH } = await import("./route");
    const res = await PATCH(
      new NextRequest("http://localhost/api/agent/approval", {
        method: "PATCH",
        body: JSON.stringify({ id: "apr_1", action: "reject" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(mocks.rejectRequest).toHaveBeenCalledWith("apr_1", "user1");
  });

  it("returns 400 when update fails", async () => {
    mocks.approveRequest.mockReturnValue(false);

    const { PATCH } = await import("./route");
    const res = await PATCH(
      new NextRequest("http://localhost/api/agent/approval", {
        method: "PATCH",
        body: JSON.stringify({ id: "apr_1", action: "approve" }),
      }),
    );
    expect(res.status).toBe(400);
  });
});
