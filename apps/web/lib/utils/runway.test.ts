import { describe, expect, it } from "vitest";
import { fitWithin, formatCountdown, runwayCtaOrder } from "./runway";

describe("runwayCtaOrder", () => {
  it("leads with sms on iPhone/iPad", () => {
    expect(runwayCtaOrder("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe("sms-first");
    expect(runwayCtaOrder("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe("sms-first");
  });
  it("leads with the browser everywhere else", () => {
    expect(runwayCtaOrder("Mozilla/5.0 (Linux; Android 13)")).toBe("web-first");
    expect(runwayCtaOrder("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)")).toBe("web-first");
    expect(runwayCtaOrder("")).toBe("web-first");
  });
});

describe("formatCountdown", () => {
  it("formats m:ss and clamps at zero", () => {
    expect(formatCountdown(180_000)).toBe("3:00");
    expect(formatCountdown(61_000)).toBe("1:01");
    expect(formatCountdown(30_000)).toBe("0:30");
    expect(formatCountdown(500)).toBe("0:01");
    expect(formatCountdown(0)).toBe("0:00");
    expect(formatCountdown(-5000)).toBe("0:00");
  });
  it("rounds up partial seconds", () => {
    expect(formatCountdown(90_500)).toBe("1:31");
  });
});

describe("fitWithin (downscale helper)", () => {
  it("never upscales and fits inside the cap", () => {
    expect(fitWithin(800, 600, 1024)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(4000, 3000, 1024)).toEqual({ width: 1024, height: 768 });
    expect(fitWithin(2000, 4000, 1024)).toEqual({ width: 512, height: 1024 });
  });
  it("handles square and degenerate input", () => {
    expect(fitWithin(3000, 3000, 1024)).toEqual({ width: 1024, height: 1024 });
    expect(fitWithin(0, 0, 1024)).toEqual({ width: 1024, height: 1024 });
  });
});
