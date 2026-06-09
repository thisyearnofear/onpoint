import { describe, it, expect } from "vitest";
import { buildFashionPrompt } from "../../../../lib/utils/replicate-prompt";

describe("buildFashionPrompt", () => {
  it("builds a daily outfit check prompt", () => {
    const prompt = buildFashionPrompt("daily");
    expect(prompt).toContain("professional fashion stylist");
    expect(prompt).toContain("fit, color coordination, proportion");
    expect(prompt).toContain("specific, actionable feedback");
    expect(prompt).toContain("Overall impression");
    expect(prompt).toContain("Color and palette analysis");
    expect(prompt).toContain("clear next-move recommendation");
  });

  it("builds an event prep prompt", () => {
    const prompt = buildFashionPrompt("event");
    expect(prompt).toContain("event or special occasion");
    expect(prompt).toContain("formality, silhouette, polish");
    expect(prompt).not.toContain("daily look");
  });

  it("builds a critique prompt", () => {
    const prompt = buildFashionPrompt("critique");
    expect(prompt).toContain("honest, direct critique");
    expect(prompt).toContain("what should change first");
    expect(prompt).toContain("specific and candid");
  });

  it("falls back to daily for unknown goals", () => {
    const prompt = buildFashionPrompt("unknown_goal");
    expect(prompt).toContain("daily look");
    expect(prompt).toContain("fit, color coordination, proportion");
  });

  it("includes persona instructions when persona is provided", () => {
    const prompt = buildFashionPrompt("daily", "edina");
    expect(prompt).toContain("distinct personality");
    expect(prompt).toContain("matches your persona");
    expect(prompt).toContain("authentic while delivering");
    // Should include the numbered structure
    expect(prompt).toContain("1. Overall impression");
    expect(prompt).toContain("6. A clear next-move recommendation");
  });

  it("omits persona instructions when persona is not provided", () => {
    const prompt = buildFashionPrompt("daily");
    expect(prompt).not.toContain("distinct personality");
    expect(prompt).not.toContain("matches your persona");
  });

  it("uses different opening for persona vs non-persona", () => {
    const withPersona = buildFashionPrompt("daily", "miranda");
    const withoutPersona = buildFashionPrompt("daily");

    // With persona starts with "You are a professional fashion stylist with a distinct personality"
    expect(withPersona).toContain("with a distinct personality");
    // Without persona starts with "You are a professional fashion stylist."
    expect(withoutPersona).toContain("You are a professional fashion stylist.");
    expect(withoutPersona).not.toContain("with a distinct personality");
  });

  it("includes the same numbered structure for both modes", () => {
    const prompt = buildFashionPrompt("critique", "shaft");
    expect(prompt).toContain("1. Overall impression");
    expect(prompt).toContain("2. Fit assessment");
    expect(prompt).toContain("3. Color and palette analysis");
    expect(prompt).toContain("4. Specific strengths");
    expect(prompt).toContain("5. Specific areas for improvement");
    expect(prompt).toContain("6. A clear next-move recommendation");
  });

  it("includes goal context even with persona", () => {
    const prompt = buildFashionPrompt("event", "luxury");
    expect(prompt).toContain("event or special occasion");
    expect(prompt).toContain("formality, silhouette, polish");
    expect(prompt).toContain("distinct personality");
  });
});
