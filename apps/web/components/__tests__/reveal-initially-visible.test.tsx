import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("../../lib/hooks/useInView", () => ({
  useInView: () => ({ ref: { current: null }, inView: false }),
}));

import { Reveal } from "../ui/Reveal";

describe("Reveal initiallyVisible", () => {
  it("default Reveal keeps the hidden initial state when not in view", () => {
    const html = renderToStaticMarkup(<Reveal><p>content</p></Reveal>);
    expect(html).toContain("opacity:0");
    expect(html).toContain("content");
  });

  it("initiallyVisible SSRs without opacity:0 while still rendering children", () => {
    const html = renderToStaticMarkup(<Reveal initiallyVisible><p>content</p></Reveal>);
    expect(html).not.toContain("opacity:0");
    expect(html).toContain("content");
  });
});
