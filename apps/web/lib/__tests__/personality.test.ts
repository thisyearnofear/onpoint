import { describe, it, expect, vi, beforeEach } from "vitest";
import { personalityService } from "@repo/ai-client";

describe("PersonalityService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock global fetch
    global.fetch = vi.fn();
  });

  it("returns correct persona prompt", () => {
    const prompt = personalityService.getPersonaPrompt("luxury");
    expect(prompt).toContain("luxury fashion expert");
    expect(prompt).toContain("investment piece logic");
  });

  it("returns empty string for unknown persona", () => {
    // @ts-ignore - testing invalid input
    const prompt = personalityService.getPersonaPrompt("unknown");
    expect(prompt).toBe("");
  });

  it("generates critique via API call", async () => {
    const mockCritique = "You look fabulous, sweetie!";
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ critique: mockCritique }),
    });

    const result = await personalityService.generateCritique("base64data", "edina", "real");
    
    expect(global.fetch).toHaveBeenCalledWith("/api/ai/personality-critique", expect.any(Object));
    expect(result).toBe(mockCritique);
  });

  it("handles API failure in generateCritique", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
    });

    await expect(
      personalityService.generateCritique("base64data", "miranda", "roast")
    ).rejects.toThrow("Personality critique failed: 500");
  });

  it("returns correct persona info", () => {
    const info = personalityService.getPersonalityInfo("miranda");
    expect(info.name).toBe("Miranda Priestly");
    expect(info.color).toBe("text-red-600");
  });
});
