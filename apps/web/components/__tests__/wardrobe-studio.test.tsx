import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within, fireEvent, act } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { WardrobeWorkspace } from "../wardrobe/WardrobeWorkspace";
import { STUDIO_ITEMS, STORAGE_KEY } from "../../lib/wardrobe-studio";
import { useStyleHearts } from "../../lib/stores/style-board-hearts";
import { sampleById, RUNWAY_SAMPLES, OUTFIT_SAMPLES } from "../../lib/runway-samples";

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

const openGalleryItem = (name: string) =>
  fireEvent.click(screen.getAllByRole("button", { name: `View ${name}` })[0]);

describe("WardrobeWorkspace", () => {
  afterEach(() => {
    act(() => {
      vi.restoreAllMocks();
      useStyleHearts.setState({ hearts: [] });
      window.localStorage.clear();
    });
  });

  it("server-renders the default model visibly (no opacity:0)", () => {
    const html = renderToStaticMarkup(<WardrobeWorkspace />);
    expect(html).toContain("1Model.png");
    expect(html).not.toContain("opacity:0");
    expect(html).toContain("Prepared on-model demo");
    expect(html).toContain("Your wardrobe, in play.");
  });

  it("default selection is Graphic 01 on model, first row shows garments + first featured outfit", () => {
    render(<WardrobeWorkspace />);
    expect(screen.getByRole("button", { name: "Dress model in Graphic 01" }).getAttribute("aria-pressed")).toBe("true");
    const imgs = screen.getAllByRole("img").map((i) => i.getAttribute("src") || "");
    expect(imgs).toContain("/assets/1Model.png");
    const items = screen.getAllByRole("button", { name: /^View / });
    expect(items.length).toBe(12);
    expect(items.slice(0, 4).map((b) => b.getAttribute("aria-label"))).toEqual([
      "View Graphic 01",
      "View Graphic 02",
      "View Graphic 03",
      "View Navy cardigan + jeans",
    ]);
  });

  it("selecting Graphic 02 swaps model image and pressed state; undo restores", () => {
    render(<WardrobeWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Dress model in Graphic 02" }));
    expect(screen.getByRole("button", { name: "Dress model in Graphic 02" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getAllByRole("img").some((i) => i.getAttribute("src") === "/assets/2Model.png")).toBe(true);
    const undo = screen.getByRole("button", { name: /Undo/ });
    fireEvent.click(undo);
    expect(screen.getByRole("button", { name: "Dress model in Graphic 01" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /Undo/ }).hasAttribute("disabled")).toBe(true);
  });

  it("reselecting the same item does not grow history", () => {
    render(<WardrobeWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Dress model in Graphic 02" }));
    fireEvent.click(screen.getAllByRole("button", { name: "View Graphic 02" })[0]);
    fireEvent.click(screen.getByRole("button", { name: /Undo/ }));
    expect(screen.getByRole("button", { name: /Undo/ }).hasAttribute("disabled")).toBe(true);
  });

  it("pin + compare shows two distinct labeled images; clear pin exits", () => {
    render(<WardrobeWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: /Pin for compare/ }));
    openGalleryItem("Graphic 02");
    expect(screen.getByRole("button", { name: "Compare" }).hasAttribute("disabled")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Compare" }));
    expect(screen.getByAltText("Graphic 01")).toBeTruthy();
    expect(screen.getByAltText("Graphic 02")).toBeTruthy();
    const compare = screen.getByLabelText("Comparison");
    expect(within(compare).getByText("Graphic 01")).toBeTruthy();
    expect(within(compare).getByText("Graphic 02")).toBeTruthy();
    expect(compare.textContent).toContain("on model");
    fireEvent.click(screen.getByRole("button", { name: "Clear pin" }));
    expect(screen.getByRole("button", { name: /Pin for compare/ })).toBeTruthy();
    expect(screen.getAllByRole("img").some((i) => i.getAttribute("src") === "/assets/2Model.png")).toBe(true);
  });

  it("compare stays disabled until a distinct selection is made", () => {
    render(<WardrobeWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: /Pin for compare/ }));
    expect(screen.getByRole("button", { name: "Compare" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/Pick a different piece to compare/)).toBeTruthy();
  });

  it("save persists to localStorage across remount; unsave shows empty state", () => {
    const { unmount } = render(<WardrobeWorkspace />);
    openGalleryItem("Graphic 02");
    fireEvent.click(screen.getByRole("button", { name: /Save piece/ }));
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
    expect(stored.savedIds).toEqual(["studio-graphic-02"]);
    unmount();
    render(<WardrobeWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Saved" }));
    expect(screen.getAllByRole("button", { name: "View Graphic 02" }).length).toBe(1);
    openGalleryItem("Graphic 02");
    const savedBtns = screen.getAllByRole("button", { name: "Saved" });
    fireEvent.click(savedBtns.find((b) => b.querySelector("svg"))!);
    expect(screen.getByText(/No saved pieces yet/)).toBeTruthy();
  });

  it("notes persist per item and do not auto-save a favorite", () => {
    render(<WardrobeWorkspace />);
    openGalleryItem("Graphic 02");
    fireEvent.change(screen.getByLabelText(/Private note/), { target: { value: "Works with grey cardigan" } });
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
    expect(stored.notes["studio-graphic-02"]).toBe("Works with grey cardigan");
    expect(stored.savedIds).toEqual([]);
    openGalleryItem("Graphic 03");
    expect((screen.getByLabelText(/Private note/) as HTMLTextAreaElement).value).toBe("");
    openGalleryItem("Graphic 02");
    expect((screen.getByLabelText(/Private note/) as HTMLTextAreaElement).value).toBe("Works with grey cardigan");
    fireEvent.change(screen.getByLabelText(/Private note/), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!).notes["studio-graphic-02"]).toBeUndefined();
  });

  it("ignores malformed and unknown stored data", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, savedIds: ["bogus", "spr-0161", "spr-0161"], notes: { bogus: "x", "spr-0161": "ok" } }));
    render(<WardrobeWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Saved" }));
    const items = screen.getAllByRole("button", { name: /^View / });
    expect(items.length).toBe(1);
    expect(items[0].getAttribute("aria-label")).toBe("View Navy cardigan + jeans");
  });

  it("shows explicit notice when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("denied"); });
    render(<WardrobeWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: /Save piece/ }));
    expect(screen.getByText("Saved for this visit; browser storage is unavailable.")).toBeTruthy();
  });

  it("tabs, search, occasion filters and Load more behave", () => {
    render(<WardrobeWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Clothes" }));
    expect(screen.getAllByRole("button", { name: /^View / }).length).toBe(3);
    expect(screen.queryByRole("button", { name: "Work" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Outfit ideas" }));
    fireEvent.click(screen.getByRole("button", { name: "Work" }));
    const workCount = STUDIO_ITEMS.filter((i) => i.kind === "outfit" && i.tags.some((t) => ["business", "office", "work"].includes(t))).length;
    expect(screen.getAllByRole("button", { name: /^View / }).length).toBe(Math.min(workCount, 12));

    fireEvent.click(screen.getByRole("button", { name: "All occasions" }));
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(screen.getByText(`Showing 12 of ${STUDIO_ITEMS.length}`)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Load more/ }));
    expect(screen.getAllByRole("button", { name: /^View / }).length).toBe(24);

    fireEvent.change(screen.getByLabelText("Search pieces"), { target: { value: "cardigan" } });
    const matches = STUDIO_ITEMS.filter((i) => i.title.toLowerCase().includes("cardigan") || i.tags.includes("cardigan"));
    expect(screen.getAllByRole("button", { name: /^View / }).length).toBe(matches.length);
  });

  it("garments are unaffected by occasion filter in All tab", () => {
    render(<WardrobeWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Layers" }));
    const labels = screen.getAllByRole("button", { name: /^View / }).map((b) => b.getAttribute("aria-label"));
    expect(labels).toContain("View Graphic 01");
  });

  it("undo resets filters/tab and pages far enough to reveal the previous card", () => {
    render(<WardrobeWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: /Load more/ }));
    const late = screen.getAllByRole("button", { name: /^View / }).at(-1)!;
    const lateLabel = late.getAttribute("aria-label")!.replace("View ", "");
    fireEvent.click(late);
    fireEvent.change(screen.getByLabelText("Search pieces"), { target: { value: "zzz-no-match" } });
    fireEvent.click(screen.getByRole("button", { name: "Work" }));
    fireEvent.click(screen.getByRole("button", { name: "Outfit ideas" }));
    expect(screen.queryAllByRole("button", { name: /^View / }).length).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: /Undo/ }));
    expect((screen.getByLabelText("Search pieces") as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("button", { name: "All" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getAllByRole("button", { name: `View ${lateLabel}` }).length).toBe(1);
    expect(screen.getByRole("button", { name: "All occasions" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("Saved tab distinguishes real favorites from filtered-out matches", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, savedIds: ["spr-0161"], notes: {} }));
    render(<WardrobeWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Saved" }));
    expect(screen.getByText("1 saved")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Search pieces"), { target: { value: "zzz-no-match" } });
    expect(screen.getByText("No saved pieces match these filters.")).toBeTruthy();
    expect(screen.getByText("1 saved")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getAllByRole("button", { name: "View Navy cardigan + jeans" }).length).toBe(1);
    // Outfits migrated out of the studio key into the shared picks store.
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!).savedIds).toEqual([]);
    expect(useStyleHearts.getState().hearts).toEqual(["spr-0161"]);
  });

  it("saving an outfit writes to the shared style-board picks, not the studio key", () => {
    render(<WardrobeWorkspace />);
    openGalleryItem("Navy cardigan + jeans");
    fireEvent.click(screen.getByRole("button", { name: /Save look/ }));
    expect(useStyleHearts.getState().hearts).toEqual(["spr-0161"]);
    expect((JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{"savedIds":[]}')).savedIds).toEqual([]);
  });

  it("outfits hearted on the style board appear in the studio Saved tab", () => {
    act(() => useStyleHearts.setState({ hearts: ["spr-0161", "not-a-studio-id"] }));
    render(<WardrobeWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Saved" }));
    expect(screen.getByText("1 saved")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "View Navy cardigan + jeans" }).length).toBe(1);
  });

  it("migrates legacy studio-saved outfits once, keeping garments and notes", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, savedIds: ["studio-graphic-02", "spr-0161"], notes: { "spr-0161": "keep" } }),
    );
    act(() => useStyleHearts.setState({ hearts: ["aut-0169"] }));
    render(<WardrobeWorkspace />);
    expect(useStyleHearts.getState().hearts).toEqual(["aut-0169", "spr-0161"]);
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
    expect(stored.savedIds).toEqual(["studio-graphic-02"]);
    expect(stored.notes["spr-0161"]).toBe("keep");
  });

  it("rejects version-mismatched and malformed stored payloads", () => {
    const cases = [
      JSON.stringify({ version: 2, savedIds: ["spr-0161"], notes: {} }),
      "not-json{",
      JSON.stringify({ version: 1, savedIds: "spr-0161", notes: ["x"] }),
      JSON.stringify({ savedIds: ["spr-0161"] }),
    ];
    for (const raw of cases) {
      window.localStorage.setItem(STORAGE_KEY, raw);
      const { unmount } = render(<WardrobeWorkspace />);
      fireEvent.click(screen.getByRole("button", { name: "Saved" }));
      expect(screen.getByText(/No saved pieces yet/)).toBeTruthy();
      unmount();
    }
  });

  it("gallery tap scrolls the stage into view on compact viewports only", () => {
    const mql = { matches: true, addEventListener: () => {}, removeEventListener: () => {}, media: "" };
    vi.stubGlobal("matchMedia", vi.fn(() => mql));
    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;
    render(<WardrobeWorkspace />);
    openGalleryItem("Graphic 02");
    expect(scrollSpy).toHaveBeenCalled();
    scrollSpy.mockClear();
    const rack = screen.getByRole("group", { name: "Garment rack" });
    fireEvent.click(within(rack).getByRole("button", { name: "Dress model in Graphic 03" }));
    expect(scrollSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("compact: tab tap scrolls gallery; re-tapping selected tile scrolls stage without history", () => {
    const mql = { matches: true, addEventListener: () => {}, removeEventListener: () => {}, media: "" };
    vi.stubGlobal("matchMedia", vi.fn(() => mql));
    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;
    render(<WardrobeWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Saved" }));
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    scrollSpy.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    scrollSpy.mockClear();
    openGalleryItem("Graphic 01");
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /Undo/ }).hasAttribute("disabled")).toBe(true);
    vi.unstubAllGlobals();
  });

  it("desktop: no scrolling for tabs or gallery selection", () => {
    const mql = { matches: false, addEventListener: () => {}, removeEventListener: () => {}, media: "" };
    vi.stubGlobal("matchMedia", vi.fn(() => mql));
    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;
    render(<WardrobeWorkspace />);
    openGalleryItem("Graphic 02");
    fireEvent.click(screen.getByRole("button", { name: "Saved" }));
    expect(scrollSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("outfit selection shows flatlay + verdict link, no on-model claim", () => {
    render(<WardrobeWorkspace />);
    openGalleryItem("Navy cardigan + jeans");
    expect(screen.getByText("Outfit reference · not items for sale")).toBeTruthy();
    expect(screen.queryByText("Prepared on-model demo · not your photo")).toBeNull();
    expect(screen.queryByRole("button", { name: "On model" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Piece" })).toBeNull();
    expect(screen.getByRole("img", { name: "Navy cardigan + jeans" }).getAttribute("src")).toBe("/demo/outfits/spr-0161.webp");
    expect(screen.getByRole("link", { name: /Get a verdict/ }).getAttribute("href")).toBe("/runway/play?sample=spr-0161");
    expect(screen.getByRole("link", { name: "Use my photo" }).getAttribute("href")).toBe("/lab?tab=try-on");
    expect(screen.getByRole("button", { name: /Save look/ })).toBeTruthy();
  });
});

describe("StudioClothesRack", () => {
  it("selecting via rack shares the same selection/model/history", () => {
    render(<WardrobeWorkspace />);
    const rack = screen.getByRole("group", { name: "Garment rack" });
    fireEvent.click(within(rack).getByRole("button", { name: "Dress model in Graphic 02" }));
    expect(within(rack).getByRole("button", { name: "Dress model in Graphic 02" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getAllByRole("img").some((i) => i.getAttribute("src") === "/assets/2Model.png")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Undo/ }));
    expect(within(rack).getByRole("button", { name: "Dress model in Graphic 01" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("keyboard arrows move focus without changing selection; Enter activates", () => {
    render(<WardrobeWorkspace />);
    const rack = screen.getByRole("group", { name: "Garment rack" });
    const g1 = within(rack).getByRole("button", { name: "Dress model in Graphic 01" });
    g1.focus();
    fireEvent.keyDown(rack, { key: "ArrowRight" });
    const g2 = within(rack).getByRole("button", { name: "Dress model in Graphic 02" });
    expect(document.activeElement).toBe(g2);
    expect(g2.getAttribute("aria-pressed")).toBe("false");
    fireEvent.keyDown(rack, { key: "End" });
    expect(document.activeElement).toBe(within(rack).getByRole("button", { name: "Dress model in Graphic 03" }));
    fireEvent.keyDown(rack, { key: "Home" });
    expect(document.activeElement).toBe(g1);
    expect(g1.getAttribute("aria-pressed")).toBe("true");
  });

  it("shows instruction, badge, and no hidden images", () => {
    render(<WardrobeWorkspace />);
    expect(screen.getByText("3 starter pieces")).toBeTruthy();
    expect(screen.getByText(/Turn a piece/)).toBeTruthy();
    const rack = screen.getByRole("group", { name: "Garment rack" });
    for (const img of [...rack.querySelectorAll("img")]) {
      expect(img.getAttribute("style") || "").not.toContain("opacity");
    }
    expect(rack.querySelectorAll("img").length).toBe(3);
    expect(within(rack).getAllByRole("button", { name: /Dress model in Graphic/ }).length).toBe(3);

  });
});

describe("studio model samples", () => {
  it("resolves each studio id to its matching model file", () => {
    expect(sampleById("studio-graphic-01")?.src).toBe("/assets/1Model.png");
    expect(sampleById("studio-graphic-02")?.src).toBe("/assets/2Model.png");
    expect(sampleById("studio-graphic-03")?.src).toBe("/assets/3Model.png");
    expect(sampleById("studio-graphic-01")?.label).toBe("Graphic 01 + denim shorts");
  });

  it("leaves legacy and outfit lookups unchanged", () => {
    expect(RUNWAY_SAMPLES).toHaveLength(6);
    expect(OUTFIT_SAMPLES).toHaveLength(34);
    expect(sampleById("street-layers")?.src).toBe("/demo/sample-street-layers.jpg");
    expect(sampleById("spr-0161")?.src).toBe("/demo/outfits/spr-0161.webp");
  });
});
