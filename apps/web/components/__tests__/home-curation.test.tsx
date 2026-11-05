import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HeroView } from "../home/HeroView";

describe("HeroView", () => {
  it("renders the wardrobe studio without a footer of its own", () => {
    render(<HeroView />);
    expect(screen.getByText(/Your wardrobe, in play/)).toBeTruthy();
    // One footer, in the layout. A second row here meant `/` shipped two.
    expect(document.querySelector("footer")).toBeNull();
    expect(screen.queryByRole("link", { name: "All looks" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Live agent" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Developers" })).toBeNull();
  });

  it("keeps the mobile sticky Runway pill — the tracked placement", () => {
    render(<HeroView />);
    // Hidden off-canvas at rest, so it is aria-hidden and invisible to a11y queries.
    const pill = document.querySelector("a[href=\"/runway/play\"]");
    expect(pill?.textContent).toContain("Play Runway");
  });
});
