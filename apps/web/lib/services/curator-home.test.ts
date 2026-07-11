import { describe, expect, it } from "vitest";
import {
  agentChannelLabel,
  buildWhatsAppBriefPreview,
  funnelInsight,
} from "./curator-home";

describe("curator-home", () => {
  it("builds a brief from listing preview", () => {
    const text = buildWhatsAppBriefPreview({
      curatorName: "Wanja",
      listing: { id: "x", label: "Arsenal home kit", size: "M", priceKes: 2500 },
    });
    expect(text).toContain("Wanja");
    expect(text).toContain("Arsenal home kit");
    expect(text).toContain("size M");
    expect(text).toContain("2,500");
  });

  it("describes funnel milestones in plain language", () => {
    expect(funnelInsight({ pageViews: 0, tryOns: 0, shares: 0, buyClicks: 0 }, 2)).toMatch(
      /Share your storefront/,
    );
    expect(funnelInsight({ pageViews: 5, tryOns: 2, shares: 0, buyClicks: 0 }, 2)).toMatch(
      /try-on/,
    );
  });

  it("labels agent channel by readiness", () => {
    expect(agentChannelLabel(true, "curator_owned").tone).toBe("ready");
    expect(agentChannelLabel(false, "unset").tone).toBe("off");
  });
});
