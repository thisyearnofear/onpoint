import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { HomeSections } from "../home/HomeSections";
import { FEATURED_OUTFIT_IDS, OUTFIT_SAMPLES } from "../../lib/runway-samples";

vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const dom = { ...props };
    for (const key of ["fill", "placeholder", "blurDataURL", "priority", "loader", "unoptimized", "overrideSrc"]) {
      delete dom[key];
    }
    return React.createElement("img", dom);
  },
}));

describe("HomeSections curation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("features only the six curated outfits with verdict links and disclosure", () => {
    render(<HomeSections />);
    const section = screen.getByRole("heading", { name: "Find a look. Get a verdict." }).closest("section")!;
    const links = within(section).getAllByRole("link", { name: /Get a verdict/i });
    expect(links).toHaveLength(6);
    const hrefs = links.map((l) => l.getAttribute("href"));
    for (const id of FEATURED_OUTFIT_IDS) {
      expect(hrefs).toContain(`/runway/play?sample=${id}`);
    }
    expect(within(section).queryByRole("link", { name: /street-layers|sample-street/i })).toBeNull();
    const imgs = within(section).getAllByRole("img");
    expect(imgs.some((i) => i.getAttribute("src")?.includes("sample-street-layers"))).toBe(false);
    expect(screen.getByText("AI styling references · not items for sale")).toBeTruthy();
    expect(screen.getByRole("link", { name: new RegExp(`Explore all ${OUTFIT_SAMPLES.length} looks`) }).getAttribute("href")).toBe("/style-board");
  });

  it("does not fetch the live storefront and shows one fitting-room CTA", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<HomeSections />);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Explore the on-model demo." })).toBeTruthy();
    expect(screen.getByText("Garment demos")).toBeTruthy();
    const ctas = screen.getAllByRole("link", { name: "Open fitting room" });
    expect(ctas).toHaveLength(1);
    expect(ctas[0].getAttribute("href")).toBe("/lab?tab=try-on&from=nia");
    expect(screen.getByText(/Prepared garment previews, not live inventory/)).toBeTruthy();
  });

  it("planner tile shows example inspiration, no fabricated score", () => {
    render(<HomeSections />);
    expect(screen.getByText("Agent outfit tools")).toBeTruthy();
    expect(screen.getByText("Example outfit inspiration")).toBeTruthy();
    expect(screen.getByText("Example agent flow")).toBeTruthy();
    expect(screen.queryByText(/8\.4/)).toBeNull();
    expect(screen.queryByText(/Score \d/)).toBeNull();
    expect(screen.getByRole("link", { name: /Agent outfit tools/ }).getAttribute("href")).toBe("/developers");
  });
});

describe("HeroVisual garment picker", () => {
  it("switches model on garment click and keeps honest labels", async () => {
    const { HeroVisual } = await import("../home/HeroVisual");
    render(<HeroVisual />);
    const second = screen.getByRole("button", { name: "Dress model in Graphic 02" });
    expect(second.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(second);
    expect(second.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getAllByAltText("Model wearing Graphic 02").length).toBeGreaterThan(0);
    expect(screen.getByText("Prepared model preview")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Use my photo" }).getAttribute("href")).toBe("/lab?tab=try-on&from=nia");
    expect(screen.queryByText(/On you/)).toBeNull();
    expect(screen.getByText(/Prepared previews\. Try your own photo/)).toBeTruthy();
  });

  it("server-renders the model visibly before hydration", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { HeroVisual } = await import("../home/HeroVisual");
    const html = renderToStaticMarkup(<HeroVisual />);
    const host = document.createElement("div");
    host.innerHTML = html;
    const model = host.querySelector('img[alt="Model wearing Graphic 01"]')!;
    expect(model).toBeTruthy();
    expect(model.parentElement!.getAttribute("style") || "").not.toContain("opacity:0");
    expect(host.textContent).toContain("Prepared model preview");
    expect(host.textContent).toContain("Prepared previews. Try your own photo in the fitting room.");
  });
});
