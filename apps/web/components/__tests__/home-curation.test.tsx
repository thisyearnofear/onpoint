import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HeroView } from "../home/HeroView";

describe("HeroView", () => {
  it("renders the wardrobe studio and footer", () => {
    render(<HeroView />);
    expect(screen.getByText(/Your wardrobe, in play/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Looks" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "All looks" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Developers" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Privacy" })).toBeTruthy();
  });
});
