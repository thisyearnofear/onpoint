import { describe, expect, it } from "vitest";
import {
  ARTIFACT_SOURCES,
  describeDeepLinkSource,
  resolveDeepLinkSource,
} from "../deep-link-source";

describe("resolveDeepLinkSource", () => {
  it("reads a curator slug as a storefront", () => {
    expect(resolveDeepLinkSource("nia")).toEqual({ kind: "storefront", curatorSlug: "nia" });
    expect(resolveDeepLinkSource("mo-jerseys")).toEqual({
      kind: "storefront",
      curatorSlug: "mo-jerseys",
    });
  });

  it("reads an artifact's own word as the hand-off, never as a slug", () => {
    for (const word of ARTIFACT_SOURCES) {
      expect(resolveDeepLinkSource(word)?.kind).toBe("artifact");
    }
  });

  it("returns nothing for an absent source", () => {
    expect(resolveDeepLinkSource(null)).toBeNull();
    expect(resolveDeepLinkSource(undefined)).toBeNull();
    expect(resolveDeepLinkSource("")).toBeNull();
  });

  it("decodes before deciding, so an encoded artifact word stays one", () => {
    expect(resolveDeepLinkSource("%63ard")).toEqual({ kind: "artifact", artifact: "card" });
    expect(resolveDeepLinkSource("mo-jerseys")).toEqual({
      kind: "storefront",
      curatorSlug: "mo-jerseys",
    });
  });

  it("captions a storefront by its slug and an artifact by what it is", () => {
    expect(describeDeepLinkSource(resolveDeepLinkSource("nia"))).toBe(
      "Styling from nia's storefront",
    );
    expect(describeDeepLinkSource(resolveDeepLinkSource("card"))).toBe(
      "Styled from a card someone sent you",
    );
    expect(describeDeepLinkSource(null)).toBeNull();
  });

  it("never captions an artifact as if it owned a shelf", () => {
    for (const word of ARTIFACT_SOURCES) {
      const caption = describeDeepLinkSource(resolveDeepLinkSource(word)) || "";
      expect(caption).not.toContain(`${word}'s storefront`);
    }
  });
});
