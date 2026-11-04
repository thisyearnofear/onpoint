import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HeroView } from "../home/HeroView";

describe("HeroView", () => {
  it("renders the wardrobe studio and footer links", () => {
    render(<HeroView />);
    expect(screen.getByText(/Your wardrobe, in play/)).toBeTruthy();
    // HeroView renders the footer — nav "Looks" link is in the layout header, not here
    expect(screen.getByRole("link", { name: "All looks" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Developers" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Privacy" })).toBeTruthy();
  });
});
