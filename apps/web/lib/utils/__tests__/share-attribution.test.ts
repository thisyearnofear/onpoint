import { beforeEach, describe, expect, it } from "vitest";
import {
  captureShareAttribution,
  getAttributionFields,
  getReferralCode,
  withShareParams,
} from "../share-attribution";

function visit(search: string) {
  window.history.pushState({}, "", `/s/nia${search}`);
}

describe("share attribution (client)", () => {
  beforeEach(() => {
    sessionStorage.clear();
    visit("");
  });

  it("builds share URLs with the id and channel", () => {
    const url = new URL(withShareParams("https://onpoint.test/look/fit", "a1b2c3d4e5f6", "whatsapp"));
    expect(url.searchParams.get("sid")).toBe("a1b2c3d4e5f6");
    expect(url.searchParams.get("utm_source")).toBe("whatsapp");
  });

  it("returns no fields for an anonymous visit", () => {
    captureShareAttribution();
    expect(getAttributionFields()).toEqual({});
  });

  it("returns share fields only when both the id and the look are known", () => {
    visit("?sid=a1b2c3d4e5f6");
    captureShareAttribution();
    expect(getAttributionFields()).toEqual({});

    visit("?sid=a1b2c3d4e5f6&look=weekend-fit");
    captureShareAttribution();
    expect(getAttributionFields()).toEqual({ shareId: "a1b2c3d4e5f6", lookSlug: "weekend-fit" });
  });

  it("captures ?referral= even when there is no share id", () => {
    visit("?referral=ref_abcdef01");
    captureShareAttribution();
    expect(getReferralCode()).toBe("ref_abcdef01");
    expect(getAttributionFields()).toEqual({ referralCode: "ref_abcdef01" });
  });

  it("keeps the referral after the visitor navigates to a URL without it", () => {
    visit("?referral=ref_abcdef01&sid=a1b2c3d4e5f6&look=weekend-fit");
    captureShareAttribution();
    visit("");
    captureShareAttribution();
    expect(getAttributionFields()).toEqual({
      shareId: "a1b2c3d4e5f6",
      lookSlug: "weekend-fit",
      referralCode: "ref_abcdef01",
    });
  });

  it("falls back to the code stored by the /r/[code] landing page", () => {
    sessionStorage.setItem("referral_code", "ref_11112222");
    expect(getAttributionFields()).toEqual({ referralCode: "ref_11112222" });
  });

  it("prefers the URL referral over the landing-page one", () => {
    sessionStorage.setItem("referral_code", "ref_11112222");
    visit("?referral=ref_abcdef01");
    captureShareAttribution();
    expect(getReferralCode()).toBe("ref_abcdef01");
  });

  it.each(["", "a b", "ref_abc'; DROP TABLE x;--", "x".repeat(65), "ab"])("ignores a malformed referral %j", (bad) => {
    visit(`?referral=${encodeURIComponent(bad)}`);
    captureShareAttribution();
    expect(getReferralCode()).toBeNull();
    sessionStorage.setItem("referral_code", bad);
    expect(getReferralCode()).toBeNull();
  });

  it("ignores a malformed share id", () => {
    visit("?sid=NOT%20VALID!&look=weekend-fit");
    captureShareAttribution();
    expect(getAttributionFields()).toEqual({});
  });
});
