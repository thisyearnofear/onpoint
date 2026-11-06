import { describe, expect, it, vi, beforeEach } from "vitest";

const { permanentRedirect } = vi.hoisted(() => {
  const fn = vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  });
  return { permanentRedirect: fn };
});

vi.mock("next/navigation", () => ({ permanentRedirect }));

import LooksPage from "../page";

type Query = Record<string, string | string[] | undefined>;

async function targetOf(searchParams: Query): Promise<string | undefined> {
  await LooksPage({ searchParams: Promise.resolve(searchParams) }).catch(() => null);
  return permanentRedirect.mock.calls[0]?.[0];
}

function paramsOf(href: string | undefined): URLSearchParams {
  return new URLSearchParams(href?.split("?")[1] ?? "");
}

describe("/looks — 301 into the wardrobe outfits tab", () => {
  // Braces matter: returning the mock would register it as a teardown hook.
  beforeEach(() => {
    permanentRedirect.mockClear();
  });

  it("sends a bare link to the outfits tab", async () => {
    expect(await targetOf({})).toBe("/?tab=outfits");
  });

  // A dropped param here is silent revenue loss: sid/utm_source are what make a
  // share countable, and pick/theme/judge are what the Runway fix links carry.
  it.each([
    "curator",
    "sid",
    "utm_source",
    "pick",
    "theme",
    "judge",
    "tag",
    "category",
    "occasion",
    "season",
    "sort",
  ])("carries %s across unchanged", async (key) => {
    const params = paramsOf(await targetOf({ [key]: "v-42" }));
    expect(params.get(key)).toBe("v-42");
  });

  it("carries every attribution param at once", async () => {
    const params = paramsOf(
      await targetOf({
        curator: "nia",
        sid: "a1b2c3d4e5f6",
        utm_source: "whatsapp",
        pick: "outfit-7",
        theme: "streetwear",
        judge: "nia",
      }),
    );
    expect(params.get("tab")).toBe("outfits");
    for (const [key, value] of [
      ["curator", "nia"],
      ["sid", "a1b2c3d4e5f6"],
      ["utm_source", "whatsapp"],
      ["pick", "outfit-7"],
      ["theme", "streetwear"],
      ["judge", "nia"],
    ]) {
      expect(params.get(key)).toBe(value);
    }
  });

  it("replaces a foreign tab rather than adding a second one", async () => {
    const params = paramsOf(await targetOf({ tab: "looks", tag: "streetwear" }));
    expect(params.getAll("tab")).toEqual(["outfits"]);
    expect(params.get("tag")).toBe("streetwear");
  });

  it("keeps repeated values for the same key", async () => {
    const params = paramsOf(await targetOf({ tag: ["streetwear", "ankara"] }));
    expect(params.getAll("tag")).toEqual(["streetwear", "ankara"]);
  });

  it("ignores a param with no value instead of emitting tag=", async () => {
    expect(await targetOf({ draft: undefined })).toBe("/?tab=outfits");
  });
});
