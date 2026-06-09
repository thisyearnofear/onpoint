import { describe, it, expect } from "vitest";
import { AZURE_ANALYZE_LIMIT } from "../../../../lib/utils/azure-analysis";

describe("Azure analyze rate limit config", () => {
  it("allows 20 requests per minute (F0 free tier)", () => {
    expect(AZURE_ANALYZE_LIMIT.maxRequests).toBe(20);
    expect(AZURE_ANALYZE_LIMIT.windowMs).toBe(60_000);
  });

  it("has a unique prefix for Azure", () => {
    expect(AZURE_ANALYZE_LIMIT.prefix).toBe("azure-analyze");
  });

  it("rate limit properties are correctly typed", () => {
    expect(typeof AZURE_ANALYZE_LIMIT.maxRequests).toBe("number");
    expect(typeof AZURE_ANALYZE_LIMIT.windowMs).toBe("number");
    expect(typeof AZURE_ANALYZE_LIMIT.prefix).toBe("string");
  });

  it("rate limit is at the Azure F0 free tier maximum", () => {
    // Azure F0 free tier: 20 transactions per minute
    // https://azure.microsoft.com/en-us/pricing/details/cognitive-services/computer-vision/
    expect(AZURE_ANALYZE_LIMIT.maxRequests).toBeLessThanOrEqual(20);
    expect(AZURE_ANALYZE_LIMIT.windowMs).toBe(60_000);
  });
});
