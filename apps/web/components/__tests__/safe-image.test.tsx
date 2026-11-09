import { describe, it, expect } from "vitest";
import { isOptimizableImageSrc } from "../SafeImage";

describe("isOptimizableImageSrc", () => {
  it("skips data: and blob: URLs (optimizer can't fetch them)", () => {
    expect(isOptimizableImageSrc("data:image/webp;base64,AAAA")).toBe(false);
    expect(isOptimizableImageSrc("blob:https://example.com/uuid")).toBe(false);
  });

  it("optimizes same-origin paths and allowlisted R2/API hosts", () => {
    expect(isOptimizableImageSrc("/images/look.jpg")).toBe(true);
    expect(isOptimizableImageSrc("https://bucket.r2.dev/collage.jpg")).toBe(true);
    expect(isOptimizableImageSrc("https://deep.bucket.r2.dev/a.jpg")).toBe(true);
    expect(isOptimizableImageSrc("https://api.onpoint.famile.xyz/x.jpg")).toBe(true);
  });

  it("leaves unknown remote hosts unoptimized (Next would throw)", () => {
    expect(isOptimizableImageSrc("https://evil.example.com/a.jpg")).toBe(false);
    expect(isOptimizableImageSrc("http://bucket.r2.dev/a.jpg")).toBe(false);
    expect(isOptimizableImageSrc("not a url at all")).toBe(false);
  });
});
