import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("../OnPointHeader", () => ({
  OnPointHeader: () => <header data-testid="shared-header" />,
  OnPointFooter: () => <footer data-testid="shared-footer" />,
}));

import ConsumerLayout from "../../app/(consumer)/layout";
import ConsumerLoading from "../../app/(consumer)/loading";

describe("consumer route group", () => {
  it("layout renders exactly one shared header around children + skip link", () => {
    render(<ConsumerLayout><div data-testid="child" /></ConsumerLayout>);
    expect(screen.getAllByTestId("shared-header").length).toBe(1);
    expect(screen.getAllByTestId("child").length).toBe(1);
    expect(screen.getByRole("link", { name: "Skip to content" }).getAttribute("href")).toBe("#main-content");
  });

  // The home page used to hand-roll its own footer row, so `/` rendered two.
  it("renders the shared footer once, not a page-specific second one", () => {
    render(<ConsumerLayout><div data-testid="child" /></ConsumerLayout>);
    expect(screen.getAllByTestId("shared-footer").length).toBe(1);
  });

  it("loading fallback is visible, polite, and theme-agnostic", () => {
    const html = renderToStaticMarkup(<ConsumerLoading />);
    expect(html).toContain("role=\"status\"");
    expect(html).toContain("Opening your workspace");
    expect(html).not.toContain("opacity");
    expect(html).not.toContain("dark");
  });
});
