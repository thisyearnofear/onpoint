import { describe, it, expect } from "vitest";
import {
  recordReceipt,
  getSessionReceipts,
  getAllReceipts,
  getReceipt,
  getAgentIdentity,
  type AgentAction,
} from "../services/agent-registry";

describe("Agent Registry (ERC-8004)", () => {
  describe("recordReceipt", () => {
    it("creates a receipt with required fields", async () => {
      const receipt = await recordReceipt({
        action: "analyze_outfit" as AgentAction,
        sessionId: "test-session-1",
        metadata: { score: 8 },
      });

      expect(receipt.id).toMatch(/^receipt_/);
      expect(receipt.agentId).toBe(35962);
      expect(receipt.action).toBe("analyze_outfit");
      expect(receipt.sessionId).toBe("test-session-1");
      expect(receipt.timestamp).toBeDefined();
      expect(receipt.metadata).toEqual({ score: 8 });
    });

    it("includes txHash when provided", async () => {
      const receipt = await recordReceipt({
        action: "mint_nft" as AgentAction,
        sessionId: "test-session-2",
        metadata: { tokenId: "42" },
        txHash: "0xabc123",
        chain: "celo",
      });

      expect(receipt.txHash).toBe("0xabc123");
      expect(receipt.chain).toBe("celo");
    });

    it("generates unique receipt IDs", async () => {
      const r1 = await recordReceipt({
        action: "check_wallet_balance" as AgentAction,
        sessionId: "test-unique-1",
      });
      const r2 = await recordReceipt({
        action: "check_wallet_balance" as AgentAction,
        sessionId: "test-unique-1",
      });

      expect(r1.id).not.toBe(r2.id);
    });
  });

  describe("getSessionReceipts", () => {
    it("returns receipts for a specific session", async () => {
      const sessionId = "test-filter-session";
      await recordReceipt({
        action: "analyze_outfit" as AgentAction,
        sessionId,
      });
      await recordReceipt({
        action: "recommend_product" as AgentAction,
        sessionId,
      });

      const receipts = await getSessionReceipts(sessionId);
      expect(receipts.length).toBeGreaterThanOrEqual(2);
      expect(receipts.every((r) => r.sessionId === sessionId)).toBe(true);
    });

    it("returns empty array for non-existent session", async () => {
      const receipts = await getSessionReceipts("non-existent-xyz-123");
      expect(receipts).toEqual([]);
    });
  });

  describe("getReceipt", () => {
    it("returns receipt by ID", async () => {
      const created = await recordReceipt({
        action: "propose_mint_nft" as AgentAction,
        sessionId: "test-get-id",
        metadata: { title: "Test" },
      });

      const found = await getReceipt(created.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it("returns undefined for non-existent ID", async () => {
      const found = await getReceipt("receipt_nonexistent_xyz");
      expect(found).toBeUndefined();
    });
  });

  describe("getAgentIdentity", () => {
    it("returns OnPoint agent identity", async () => {
      const identity = await getAgentIdentity();
      expect(identity.agentId).toBe(35962);
      expect(identity.name).toBe("OnPoint AI Stylist");
      expect(identity.walletAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });
  });

  describe("getAllReceipts", () => {
    it("returns paginated results", async () => {
      const result = await getAllReceipts({ limit: 5, offset: 0 });
      expect(result).toHaveProperty("receipts");
      expect(result).toHaveProperty("total");
    });
  });
});
