import { describe, expect, it } from "vitest";
import { CURATORS_FALLBACK, GET_IT_LABELS, getItTarget, storefrontDoor } from "../get-it";

const FIX_URL =
  "https://onpoint.test/s/nia?item=l1&sid=abc123def456&utm_source=imessage&from=runway&theme=black-tie&judge=miranda";

describe("getItTarget — the Runway fix table", () => {
  it("names purchasable inventory Get it and keeps the server's URL verbatim", () => {
    expect(getItTarget({ kind: "listing", url: FIX_URL })).toEqual({
      label: "Get it",
      href: FIX_URL,
    });
    expect(getItTarget({ kind: "look", url: "/look/weekend-n19o?sid=abc123" })).toEqual({
      label: "Get it",
      href: "/look/weekend-n19o?sid=abc123",
    });
  });

  it("calls an inspiration outfit a try-on, because it is not stock", () => {
    expect(getItTarget({ kind: "inspiration", url: "/?tab=outfits&pick=o1&sid=abc123" })).toEqual({
      label: "Try it on",
      href: "/?tab=outfits&pick=o1&sid=abc123",
    });
  });

  it("never offers a dead CTA — unknown kind, missing url, or no fix at all", () => {
    expect(getItTarget({ kind: "mystery", url: "/somewhere" })).toEqual(CURATORS_FALLBACK);
    expect(getItTarget({ kind: "listing" })).toEqual(CURATORS_FALLBACK);
    expect(getItTarget(null)).toEqual(CURATORS_FALLBACK);
    expect(getItTarget(undefined)).toEqual(CURATORS_FALLBACK);
  });

  it("falls back to supply, never to the mock house catalog", () => {
    expect(CURATORS_FALLBACK).toEqual({
      label: "Ask a curator who stocks it",
      href: "/curators",
    });
    expect(Object.values(GET_IT_LABELS)).not.toContain("Shop");
  });
});

describe("storefrontDoor — a surface that knows the listing", () => {
  it("builds the canonical /s/{slug}?item={id}", () => {
    expect(storefrontDoor({ curatorSlug: "nia", listingId: "l1" })).toEqual({
      label: "Get it",
      href: "/s/nia?item=l1",
    });
  });

  it("refuses a half-resolved listing", () => {
    expect(storefrontDoor({ curatorSlug: "nia" })).toEqual(CURATORS_FALLBACK);
    expect(storefrontDoor({ listingId: "l1" })).toEqual(CURATORS_FALLBACK);
    expect(storefrontDoor(null)).toEqual(CURATORS_FALLBACK);
    expect(storefrontDoor(undefined)).toEqual(CURATORS_FALLBACK);
  });
});
