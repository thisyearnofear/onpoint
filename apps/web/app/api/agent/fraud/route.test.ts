import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkAgentHealth: vi.fn(),
  isAgentFrozen: vi.fn(),
  freezeAgent: vi.fn(),
  unfreezeAgent: vi.fn(),
  getMultiSigRequirement: vi.fn(),
  addMultiSigSignature: vi.fn(),
}));

vi.mock("../../../../lib/services/fraud-detection", () => ({
  checkAgentHealth: mocks.checkAgentHealth,
  isAgentFrozen: mocks.isAgentFrozen,
  freezeAgent: mocks.freezeAgent,
  unfreezeAgent: mocks.unfreezeAgent,
  getMultiSigRequirement: mocks.getMultiSigRequirement,
  addMultiSigSignature: mocks.addMultiSigSignature,
}));

vi.mock("../../../../middleware/agent-auth", () => ({
  requireAuthWithRateLimit:
    (handler: Function) => (req: NextRequest) =>
      handler(req, { userId: "user1", agentId: "onpoint-stylist", tier: "premium", permissions: [] }),
}));

describe("GET /api/agent/fraud", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("health check", () => {
    it("returns agent health and frozen status", async () => {
      mocks.checkAgentHealth.mockResolvedValue({
        status: "healthy",
        anomalyScore: 0,
        lastHeartbeat: Date.now(),
      });
      mocks.isAgentFrozen.mockResolvedValue({ frozen: false });

      const { GET } = await import("./route");
      const res = await GET(new NextRequest("http://localhost/api/agent/fraud?action=health"));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.health.status).toBe("healthy");
      expect(body.frozen.frozen).toBe(false);
    });

    it("returns frozen status when agent is frozen", async () => {
      mocks.checkAgentHealth.mockResolvedValue({
        status: "frozen",
        anomalyScore: 80,
        lastHeartbeat: Date.now() - 20 * 60 * 1000,
      });
      mocks.isAgentFrozen.mockResolvedValue({
        frozen: true,
        reason: "High anomaly score: 80",
      });

      const { GET } = await import("./route");
      const res = await GET(new NextRequest("http://localhost/api/agent/fraud?action=health"));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.health.status).toBe("frozen");
      expect(body.frozen.frozen).toBe(true);
      expect(body.frozen.reason).toContain("anomaly score");
    });

    it("uses agentId from query param", async () => {
      mocks.checkAgentHealth.mockResolvedValue({
        status: "healthy",
        anomalyScore: 0,
        lastHeartbeat: Date.now(),
      });
      mocks.isAgentFrozen.mockResolvedValue({ frozen: false });

      const { GET } = await import("./route");
      await GET(new NextRequest("http://localhost/api/agent/fraud?action=health&agentId=custom-agent"));

      expect(mocks.checkAgentHealth).toHaveBeenCalledWith("custom-agent", "user1");
    });
  });

  describe("multisig lookup", () => {
    it("returns multisig requirement by txId", async () => {
      mocks.getMultiSigRequirement.mockResolvedValue({
        transactionId: "multisig_123",
        status: "pending",
        requiredSignatures: 2,
        signatures: [],
      });

      const { GET } = await import("./route");
      const res = await GET(new NextRequest("http://localhost/api/agent/fraud?action=multisig&txId=multisig_123"));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.requirement.transactionId).toBe("multisig_123");
      expect(body.requirement.status).toBe("pending");
    });

    it("returns 400 when txId missing for multisig action", async () => {
      const { GET } = await import("./route");
      const res = await GET(new NextRequest("http://localhost/api/agent/fraud?action=multisig"));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toContain("Transaction ID required");
    });

    it("returns 404 when multisig requirement not found", async () => {
      mocks.getMultiSigRequirement.mockResolvedValue(null);

      const { GET } = await import("./route");
      const res = await GET(new NextRequest("http://localhost/api/agent/fraud?action=multisig&txId=nonexistent"));
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.error).toContain("not found");
    });
  });

  describe("invalid action", () => {
    it("returns 400 for unknown action", async () => {
      const { GET } = await import("./route");
      const res = await GET(new NextRequest("http://localhost/api/agent/fraud?action=unknown"));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toContain("Invalid action");
    });
  });
});

describe("POST /api/agent/fraud", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("freeze", () => {
    it("freezes an agent", async () => {
      mocks.freezeAgent.mockResolvedValue(undefined);

      const { POST } = await import("./route");
      const res = await POST(
        new NextRequest("http://localhost/api/agent/fraud", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "freeze",
            agentId: "onpoint-stylist",
            reason: "Suspicious activity",
          }),
        }),
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.message).toContain("frozen");
      expect(mocks.freezeAgent).toHaveBeenCalledWith("onpoint-stylist", "user1", "Suspicious activity");
    });

    it("rejects freeze without reason", async () => {
      const { POST } = await import("./route");
      const res = await POST(
        new NextRequest("http://localhost/api/agent/fraud", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "freeze",
            agentId: "onpoint-stylist",
          }),
        }),
      );

      expect(res.status).toBe(400);
    });
  });

  describe("unfreeze", () => {
    it("unfreezes an agent", async () => {
      mocks.unfreezeAgent.mockResolvedValue(undefined);

      const { POST } = await import("./route");
      const res = await POST(
        new NextRequest("http://localhost/api/agent/fraud", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "unfreeze",
            agentId: "onpoint-stylist",
          }),
        }),
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.message).toContain("unfrozen");
      expect(mocks.unfreezeAgent).toHaveBeenCalledWith("onpoint-stylist", "user1");
    });
  });

  describe("sign_multisig", () => {
    it("adds signature to multisig requirement", async () => {
      mocks.addMultiSigSignature.mockResolvedValue({
        transactionId: "multisig_123",
        status: "pending",
        signatures: [{ signer: "user1", signature: "sig1", timestamp: Date.now() }],
      });

      const { POST } = await import("./route");
      const res = await POST(
        new NextRequest("http://localhost/api/agent/fraud", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "sign_multisig",
            transactionId: "multisig_123",
            signature: "sig1",
          }),
        }),
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.approved).toBe(false);
      expect(mocks.addMultiSigSignature).toHaveBeenCalledWith("multisig_123", "user1", "sig1");
    });

    it("marks multisig as approved when threshold met", async () => {
      mocks.addMultiSigSignature.mockResolvedValue({
        transactionId: "multisig_123",
        status: "approved",
        signatures: [
          { signer: "user1", signature: "sig1", timestamp: Date.now() },
          { signer: "user2", signature: "sig2", timestamp: Date.now() },
        ],
      });

      const { POST } = await import("./route");
      const res = await POST(
        new NextRequest("http://localhost/api/agent/fraud", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "sign_multisig",
            transactionId: "multisig_123",
            signature: "sig2",
          }),
        }),
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.approved).toBe(true);
    });

    it("returns 404 when multisig requirement not found", async () => {
      mocks.addMultiSigSignature.mockResolvedValue(null);

      const { POST } = await import("./route");
      const res = await POST(
        new NextRequest("http://localhost/api/agent/fraud", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "sign_multisig",
            transactionId: "nonexistent",
            signature: "sig1",
          }),
        }),
      );
      const body = await res.json();

      expect(res.status).toBe(404);
    });
  });

  describe("invalid action", () => {
    it("returns 400 for unknown action", async () => {
      const { POST } = await import("./route");
      const res = await POST(
        new NextRequest("http://localhost/api/agent/fraud", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "unknown" }),
        }),
      );

      expect(res.status).toBe(400);
    });
  });
});
