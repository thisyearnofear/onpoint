import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within, fireEvent, act } from "@testing-library/react";
import { LiveLooks } from "../LiveLooks";
import { DEFAULT_LIVE_LOOKS_FILTERS, type LiveLooksFilters } from "../../../lib/looks/params";
import type { LookCardData } from "../../LookCard";

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: React.PropsWithChildren<{ href: string } & Record<string, unknown>>) =>
    React.createElement("a", { href, ...rest }, children),
}));

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

const look = (slug: string, over: Partial<LookCardData> = {}): LookCardData => ({
  id: slug,
  slug,
  title: `Look ${slug}`,
  description: null,
  agentAddress: "0x0000000000000000000000000000000000000000",
  curatorSlug: "nia",
  coverImageKey: null,
  coverImageUrl: null,
  heroImageUrl: null,
  collageUrl: null,
  tags: ["casual"],
  metadata: null,
  tryOnCount: 1,
  shareCount: 0,
  itemCount: 2,
  createdAt: new Date().toISOString(),
  items: [],
  ...over,
});

const setup = (filters: Partial<LiveLooksFilters> = {}) => {
  const onFiltersChange = vi.fn();
  const merged = { ...DEFAULT_LIVE_LOOKS_FILTERS, ...filters };
  const utils = render(<LiveLooks filters={merged} onFiltersChange={onFiltersChange} />);
  return { ...utils, onFiltersChange };
};

const json = (looks: LookCardData[]) =>
  Promise.resolve({ ok: true, json: async () => ({ looks }) });

describe("LiveLooks", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.pushState({}, "", "/");
  });

  it("renders real curator looks, not studio samples", async () => {
    const fetchMock = vi.fn(() => json([look("alpha"), look("beta")]));
    vi.stubGlobal("fetch", fetchMock);
    setup();
    await act(async () => {});
    expect(await screen.findByText("Look alpha")).toBeTruthy();
    expect(screen.getAllByRole("heading", { name: /^Look / })).toHaveLength(2);
    expect(screen.getAllByText("From nia · 2 pieces")).toHaveLength(2);
    expect(fetchMock.mock.calls[0][0]).toContain("/api/looks?limit=48");
  });

  it("names the filters it carries into the query", async () => {
    const fetchMock = vi.fn(() => json([look("alpha")]));
    vi.stubGlobal("fetch", fetchMock);
    setup({ category: "streetwear", occasion: "date-night", season: "winter", curator: "nia" });
    await act(async () => {});
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("category=streetwear");
    expect(url).toContain("occasion=date-night");
    expect(url).toContain("season=winter");
    expect(url).toContain("curator=nia");
  });

  it("loading state invents no counts", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    setup();
    expect(screen.getByText("Loading live looks…")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Live looks from curators" }).getAttribute("aria-busy")).toBe("true");
    expect(document.body.textContent).not.toMatch(/\d+ (looks|outfits)/);
  });

  it("clicking a filter rewrites the URL and preserves the share context", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json([look("alpha")])));
    window.history.pushState({}, "", "/?tab=outfits&pick=aut-0169&sid=abc123&utm_source=twitter");
    const { onFiltersChange } = setup();
    await screen.findByText("Look alpha");

    const vibeRow = within(screen.getByRole("group", { name: "Vibe" }));
    fireEvent.click(vibeRow.getByRole("button", { name: "Formal" }));
    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ category: "formal" }));
    const search = new URLSearchParams(window.location.search);
    expect(search.get("tab")).toBe("outfits");
    expect(search.get("category")).toBe("formal");
    expect(search.get("pick")).toBe("aut-0169");
    expect(search.get("sid")).toBe("abc123");
    expect(search.get("utm_source")).toBe("twitter");
  });

  it("an unreachable API says so and keeps the studio references honest", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, status: 503 })));
    setup();
    expect(await screen.findByText("Live looks aren't reachable right now.")).toBeTruthy();
    expect(screen.getByText(/studio references below are still here/)).toBeTruthy();
    expect(screen.queryAllByRole("link", { name: /^Look / })).toHaveLength(0);
  });

  it("an empty result with filters on offers a way back out", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json([])));
    const { onFiltersChange } = setup({ category: "ankara" });
    expect(await screen.findByRole("heading", { name: "No looks match those filters" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Clear filters/ }));
    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ category: "" }));
  });

  it("an empty wardrobe-level result hands off to curators rather than dead-ending", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json([])));
    setup();
    expect(await screen.findByRole("heading", { name: "No looks yet" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Browse curators" }).getAttribute("href")).toBe("/curators");
    expect(screen.getByRole("link", { name: /Nia/ }).getAttribute("href")).toBe("/s/nia");
  });
});
