import { describe, expect, it } from "vitest";
import { classifyLimit, formatWait, looksLeft, readLimit } from "./allowance";

describe("classifyLimit", () => {
  it("≤90s is the minute-window breather", () => {
    expect(classifyLimit(1)).toBe("breather");
    expect(classifyLimit(60)).toBe("breather");
    expect(classifyLimit(90)).toBe("breather");
  });
  it(">90s is the daily cap", () => {
    expect(classifyLimit(91)).toBe("daily");
    expect(classifyLimit(42233)).toBe("daily");
  });
});

describe("formatWait", () => {
  it("seconds under a minute", () => {
    expect(formatWait(42)).toBe("42s");
    expect(formatWait(59)).toBe("59s");
  });
  it("minutes + seconds under an hour", () => {
    expect(formatWait(95)).toBe("1m 35s");
    expect(formatWait(300)).toBe("5m");
    expect(formatWait(3599)).toBe("59m 59s");
  });
  it("hours round remaining minutes up", () => {
    expect(formatWait(3700)).toBe("1h 2m");
    expect(formatWait(42233)).toBe("11h 44m");
    expect(formatWait(3600)).toBe("1h");
  });
  it("never renders 0s", () => {
    expect(formatWait(0)).toBe("1s");
    expect(formatWait(-5)).toBe("1s");
  });
});

describe("looksLeft", () => {
  it("halves remaining on the daily window", () => {
    expect(looksLeft(5, 20)).toBe(2);
    expect(looksLeft(6, 20)).toBe(3);
    expect(looksLeft(1, 20)).toBe(0);
    expect(looksLeft(0, 20)).toBe(0);
  });
  it("is null when the window isn't daily", () => {
    expect(looksLeft(4, 5)).toBeNull();
    expect(looksLeft(null, 20)).toBeNull();
    expect(looksLeft(5, null)).toBeNull();
    expect(looksLeft(Number.NaN, 20)).toBeNull();
  });
});

describe("readLimit", () => {
  const headers = (h: Record<string, string>) => new Headers(h);

  it("reads retryAfter from the body first", () => {
    const r = readLimit(
      headers({ "retry-after": "99", "x-ratelimit-remaining": "3", "x-ratelimit-limit": "20" }),
      { error: "Too Many Requests", retryAfter: 12 },
    );
    expect(r).toEqual({ retryAfterSec: 12, remaining: 3, limit: 20 });
  });

  it("falls back to the Retry-After header", () => {
    const r = readLimit(headers({ "retry-after": "30" }), { error: "x" });
    expect(r.retryAfterSec).toBe(30);
  });

  it("returns nulls for missing or non-numeric values", () => {
    const r = readLimit(headers({ "x-ratelimit-remaining": "abc" }), null);
    expect(r).toEqual({ retryAfterSec: null, remaining: null, limit: null });
  });
});
