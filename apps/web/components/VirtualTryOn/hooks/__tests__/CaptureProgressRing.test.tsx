import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { CaptureProgressRing } from "../CaptureProgressRing";

describe("CaptureProgressRing", () => {
  it("renders two circles (track + progress)", () => {
    const { container } = render(<CaptureProgressRing used={1} total={3} />);
    const circles = container.querySelectorAll("circle");
    expect(circles).toHaveLength(2);
  });

  it("renders with empty progress when used=0", () => {
    const { container } = render(<CaptureProgressRing used={0} total={3} />);
    const progressCircle = container.querySelectorAll("circle")[1];
    // When progress=0, offset = full circumference (the arc is fully hidden)
    const circumference = 2 * Math.PI * 26;
    expect(progressCircle.getAttribute("stroke-dashoffset")).toBe(
      String(circumference),
    );
  });

  it("renders with full progress when used=total", () => {
    const { container } = render(<CaptureProgressRing used={3} total={3} />);
    const progressCircle = container.querySelectorAll("circle")[1];
    // When progress=1, offset = 0 (the arc is fully visible)
    expect(progressCircle.getAttribute("stroke-dashoffset")).toBe("0");
  });

  it("renders with half progress at 50%", () => {
    const { container } = render(<CaptureProgressRing used={2} total={4} />);
    const progressCircle = container.querySelectorAll("circle")[1];
    const circumference = 2 * Math.PI * 26;
    // progress=0.5, offset = circumference * 0.5
    const expectedOffset = circumference * 0.5;
    expect(progressCircle.getAttribute("stroke-dashoffset")).toBe(
      String(expectedOffset),
    );
  });

  it("clamps progress to 1 when used > total", () => {
    const { container } = render(<CaptureProgressRing used={5} total={3} />);
    const progressCircle = container.querySelectorAll("circle")[1];
    // progress clamped to 1 → offset = 0
    expect(progressCircle.getAttribute("stroke-dashoffset")).toBe("0");
  });

  it("handles total=0 gracefully (no division by zero)", () => {
    const { container } = render(<CaptureProgressRing used={0} total={0} />);
    const progressCircle = container.querySelectorAll("circle")[1];
    const circumference = 2 * Math.PI * 26;
    // progress=0 (because total>0 is false), offset = full circumference
    expect(progressCircle.getAttribute("stroke-dashoffset")).toBe(
      String(circumference),
    );
  });

  it("is aria-hidden and pointer-events-none (decorative only)", () => {
    const { container } = render(<CaptureProgressRing used={1} total={3} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.className.baseVal).toContain("pointer-events-none");
  });
});
