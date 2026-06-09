import { describe, it, expect } from "vitest";
import { formatAzureAnalysis } from "../../../../lib/utils/azure-analysis";

describe("formatAzureAnalysis", () => {
  it("parses a full response with caption, dense captions, tags, and objects", () => {
    const result = {
      captionResult: { text: "a woman wearing a blue dress and heels", confidence: 0.92 },
      denseCaptionsResult: {
        values: [
          { text: "a woman wearing a blue dress", confidence: 0.95 },
          { text: "a pair of black high-heeled shoes", confidence: 0.88 },
          { text: "a silver necklace", confidence: 0.72 },
          { text: "a brick wall background", confidence: 0.61 },
        ],
      },
      tagsResult: {
        tags: [
          { name: "dress", confidence: 0.98 },
          { name: "footwear", confidence: 0.91 },
          { name: "jewelry", confidence: 0.82 },
          { name: "person", confidence: 0.99 },
          { name: "indoor", confidence: 0.76 },
        ],
      },
      objectsResult: {
        objects: [
          { name: "dress", confidence: 0.95 },
          { name: "shoe", confidence: 0.87 },
          { name: "necklace", confidence: 0.73 },
        ],
      },
    };

    const output = formatAzureAnalysis(result);

    expect(output).toContain("📝 a woman wearing a blue dress and heels");
    expect(output).toContain("🔍 Details:");
    expect(output).toContain("a woman wearing a blue dress");
    expect(output).toContain("a pair of black high-heeled shoes");
    expect(output).toContain("a silver necklace");
    expect(output).not.toContain("brick wall background");

    expect(output).toContain("👕 Detected:");
    expect(output).toContain("dress");
    expect(output).toContain("footwear");
    expect(output).toContain("jewelry");
    expect(output).not.toContain("person");
    expect(output).not.toContain("indoor");

    expect(output).toContain("🎯 Items:");
    expect(output).toContain("dress");
    expect(output).toContain("shoe");
    expect(output).toContain("necklace");
  });

  it("handles a minimal response with only a caption", () => {
    const result = {
      captionResult: { text: "a person wearing a red jacket", confidence: 0.85 },
    };

    const output = formatAzureAnalysis(result);

    expect(output).toContain("📝 a person wearing a red jacket");
    expect(output).not.toContain("🔍");
    expect(output).not.toContain("👕");
    expect(output).not.toContain("🎯");
  });

  it("handles a response with only tags and objects (no caption)", () => {
    const result = {
      tagsResult: {
        tags: [
          { name: "sneakers", confidence: 0.95 },
          { name: "t-shirt", confidence: 0.89 },
          { name: "denim", confidence: 0.81 },
          { name: "outdoor", confidence: 0.73 },
        ],
      },
      objectsResult: {
        objects: [
          { name: "shoe", confidence: 0.92 },
        ],
      },
    };

    const output = formatAzureAnalysis(result);

    expect(output).not.toContain("📝");
    expect(output).toContain("👕 Detected:");
    expect(output).toContain("sneakers");
    expect(output).toContain("t-shirt");
    expect(output).toContain("denim");
    expect(output).not.toContain("outdoor");
    expect(output).toContain("🎯 Items:");
    expect(output).toContain("shoe");
  });

  it("filters out non-fashion tags (indoor, outdoor, text, person, portrait)", () => {
    const result = {
      tagsResult: {
        tags: [
          { name: "dress", confidence: 0.97 },
          { name: "person", confidence: 0.99 },
          { name: "indoor", confidence: 0.88 },
          { name: "outdoor", confidence: 0.82 },
          { name: "text", confidence: 0.76 },
          { name: "portrait", confidence: 0.91 },
        ],
      },
    };

    const output = formatAzureAnalysis(result);

    expect(output).toContain("dress");
    expect(output).not.toContain("person");
    expect(output).not.toContain("indoor");
    expect(output).not.toContain("outdoor");
    expect(output).not.toContain("text");
    expect(output).not.toContain("portrait");
  });

  it("includes caption and objects even when fashion tags are filtered", () => {
    const result = {
      captionResult: { text: "a blurry image", confidence: 0.34 },
      tagsResult: {
        tags: [
          { name: "indoor", confidence: 0.95 },
          { name: "text", confidence: 0.86 },
        ],
      },
      objectsResult: {
        objects: [
          { name: "table", confidence: 0.62 },
        ],
      },
    };

    const output = formatAzureAnalysis(result);

    expect(output).toContain("📝 a blurry image");
    expect(output).toContain("🎯 Items:");
    expect(output).toContain("table");
  });

  it("returns fallback message for an empty result object", () => {
    const output = formatAzureAnalysis({});
    expect(output).toBe(
      "Analysis completed. No specific fashion attributes detected in this frame.",
    );
  });

  it("handles null/undefined fields gracefully", () => {
    const result = {
      captionResult: null,
      denseCaptionsResult: undefined,
      tagsResult: null,
      objectsResult: undefined,
    };

    const output = formatAzureAnalysis(result);
    expect(output).toBe(
      "Analysis completed. No specific fashion attributes detected in this frame.",
    );
  });

  it("skips dense captions below confidence threshold (0.5)", () => {
    const result = {
      denseCaptionsResult: {
        values: [
          { text: "low confidence caption", confidence: 0.42 },
          { text: "another low confidence", confidence: 0.18 },
        ],
      },
    };

    const output = formatAzureAnalysis(result);
    expect(output).toBe(
      "Analysis completed. No specific fashion attributes detected in this frame.",
    );
    expect(output).not.toContain("low confidence");
  });

  it("skips tags below confidence threshold (0.7)", () => {
    const result = {
      tagsResult: {
        tags: [
          { name: "dress", confidence: 0.65 },
          { name: "hat", confidence: 0.42 },
        ],
      },
    };

    const output = formatAzureAnalysis(result);
    expect(output).toBe(
      "Analysis completed. No specific fashion attributes detected in this frame.",
    );
    expect(output).not.toContain("dress");
    expect(output).not.toContain("hat");
  });

  it("handles empty arrays in dense captions, tags, and objects", () => {
    const result = {
      denseCaptionsResult: { values: [] },
      tagsResult: { tags: [] },
      objectsResult: { objects: [] },
    };

    const output = formatAzureAnalysis(result);
    expect(output).toBe(
      "Analysis completed. No specific fashion attributes detected in this frame.",
    );
  });

  it("handles partially malformed confidence values", () => {
    const result = {
      captionResult: { text: "a person in a suit", confidence: 0.91 },
      denseCaptionsResult: {
        values: [
          { text: "valid caption" },
          { text: "another caption", confidence: undefined },
        ],
      },
      tagsResult: {
        tags: [
          { name: "suit", confidence: 0.85 },
          { name: "tie", confidence: undefined },
        ],
      },
    };

    const output = formatAzureAnalysis(result);

    expect(output).toContain("📝 a person in a suit");
    expect(output).not.toContain("valid caption");
    expect(output).not.toContain("tie");
    expect(output).toContain("suit");
  });

  it("joins multiple dense captions with pipe separator", () => {
    const result = {
      denseCaptionsResult: {
        values: [
          { text: "first caption", confidence: 0.95 },
          { text: "second caption", confidence: 0.89 },
          { text: "third caption", confidence: 0.82 },
        ],
      },
    };

    const output = formatAzureAnalysis(result);

    expect(output).toContain("🔍 Details: first caption | second caption | third caption");
  });
});
