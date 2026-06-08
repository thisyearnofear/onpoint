import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SignerClient, createSignerClient } from "../signer-client";

const TEST_URL = "http://127.0.0.1:48753";
const TEST_KEY = "test-signer-key-1234567890123456";

describe("SignerClient", () => {
  let client: SignerClient;

  beforeEach(() => {
    client = createSignerClient(TEST_URL, TEST_KEY);
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("signTransfer", () => {
    it("sends a transfer signing request and returns txHash", async () => {
      const mockResponse = {
        success: true,
        txHash: "0xabcdef1234567890",
        explorerUrl: "https://celoscan.io/tx/0xabcdef1234567890",
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await client.signTransfer({
        chain: "celo",
        tokenAddress: "0x765de816845861e75a25fca122bb6898e8ebb1b5",
        to: "0x5b33E63440e95289207120B94da78CE22F9D24fB",
        amountWei: "1000000000000000000",
        action: "purchase",
        agentId: "onpoint-stylist",
        userId: "user_abc123",
        suggestionId: "sug_xyz789",
        description: "Purchase 1x Fashion Item",
      });

      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        `${TEST_URL}/sign/transfer`,
        expect.objectContaining({
          method: "POST",
          headers: {
            "x-signer-key": TEST_KEY,
            "Content-Type": "application/json",
          },
          body: expect.stringContaining("purchase"),
        }),
      );
    });

    it("throws on HTTP error response", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: "Agent is frozen",
          code: "AGENT_FROZEN",
        }),
      } as Response);

      await expect(
        client.signTransfer({
          chain: "celo",
          tokenAddress: "0x765de816845861e75a25fca122bb6898e8ebb1b5",
          to: "0x5b33E63440e95289207120B94da78CE22F9D24fB",
          amountWei: "1000000000000000000",
          action: "purchase",
          agentId: "onpoint-stylist",
          userId: "user_abc123",
          suggestionId: "sug_xyz789",
          description: "Test",
        }),
      ).rejects.toThrow("Agent is frozen");
    });

    it("throws on network error", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error("ECONNREFUSED"));

      await expect(
        client.signTransfer({
          chain: "celo",
          tokenAddress: "0x765de816845861e75a25fca122bb6898e8ebb1b5",
          to: "0x5b33E63440e95289207120B94da78CE22F9D24fB",
          amountWei: "500000000000000000",
          action: "tip",
          agentId: "onpoint-stylist",
          userId: "user_abc123",
          suggestionId: "sug_tip001",
          description: "Agent tip",
        }),
      ).rejects.toThrow("ECONNREFUSED");
    });
  });

  describe("signMint", () => {
    it("sends a mint signing request and returns tokenId", async () => {
      const mockResponse = {
        success: true,
        txHash: "0xdeadbeef",
        tokenId: "42",
        explorerUrl: "https://celoscan.io/tx/0xdeadbeef",
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await client.signMint({
        chain: "celo",
        nftContract: "0x1234567890123456789012345678901234567890",
        metadataUri: "ipfs://onpoint/autonomous/sug_mint001",
        recipients: [
          { address: "0xuser12345678901234567890123456789012345678", percentAllocation: 85 },
          { address: "0x5b33E63440e95289207120B94da78CE22F9D24fB", percentAllocation: 15 },
        ],
        agentId: "onpoint-stylist",
        userId: "user_abc123",
        suggestionId: "sug_mint001",
      });

      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        `${TEST_URL}/sign/mint`,
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("ipfs://onpoint/autonomous/sug_mint001"),
        }),
      );
    });
  });

  describe("signContract", () => {
    it("sends a generic contract signing request", async () => {
      const mockResponse = {
        success: true,
        txHash: "0x1234567890abcdef",
        explorerUrl: "https://celoscan.io/tx/0x1234567890abcdef",
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await client.signContract({
        chain: "celo",
        to: "0x765de816845861e75a25fca122bb6898e8ebb1b5",
        data: "0x",
        value: "0",
        agentId: "onpoint-stylist",
        userId: "user_abc123",
        suggestionId: "sug_contract001",
        description: "Generic contract call",
      });

      expect(result).toEqual(mockResponse);
    });
  });

  describe("health", () => {
    it("returns signer health status", async () => {
      const mockHealth = {
        status: "running",
        process: "onpoint-signer",
        address: "0x5b33E63440e95289207120B94da78CE22F9D24fB",
        gasBalance: "0.42",
        chain: "celo",
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockHealth,
      } as Response);

      const result = await client.health();
      expect(result).toEqual(mockHealth);
      expect(fetch).toHaveBeenCalledWith(
        `${TEST_URL}/health`,
        expect.objectContaining({
          method: "GET",
        }),
      );
    });
  });
});

describe("createSignerClient", () => {
  it("creates a client with the given URL and key", () => {
    const c = createSignerClient("http://localhost:48753", "key123");
    expect(c).toBeInstanceOf(SignerClient);
  });

  it("strips trailing slash from URL", () => {
    const c = createSignerClient("http://localhost:48753/", "key123");
    expect(c).toBeInstanceOf(SignerClient);
  });
});
