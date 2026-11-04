import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { resolveThemePreference, setTheme, THEME_INIT_SCRIPT } from "../../lib/theme";

vi.mock("@repo/ui/button", () => ({ Button: (p: Record<string, unknown>) => React.createElement("button", p) }));

import { ThemeToggle } from "../ThemeToggle";

describe("theme resolution", () => {
  afterEach(() => {
    document.documentElement.classList.remove("dark");
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("validates stored values and falls back to system", () => {
    expect(resolveThemePreference("dark", false)).toBe("dark");
    expect(resolveThemePreference("light", true)).toBe("light");
    expect(resolveThemePreference("bogus", true)).toBe("dark");
    expect(resolveThemePreference("bogus", false)).toBe("light");
    expect(resolveThemePreference(null, true)).toBe("dark");
  });

  it("setTheme toggles DOM even when storage throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("denied"); });
    setTheme("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("two toggles stay in sync and remount does not reset", async () => {
    document.documentElement.classList.add("dark");
    const first = render(<ThemeToggle />);
    const second = render(<ThemeToggle />);
    fireEvent.click(screen.getAllByRole("button", { name: /Switch to/ })[0]);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Switch to dark mode" }).length).toBe(2);
    });
    first.unmount(); second.unmount();
    render(<ThemeToggle />);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeTruthy();
    });
  });

  it("init script tolerates blocked storage and honors system dark", () => {
    const g = {
      localStorage: { getItem: () => { throw new Error("denied"); } },
      matchMedia: () => ({ matches: true }),
      navigator: {},
      document: { documentElement: { classList: { toggle: vi.fn(), add: vi.fn() }, style: {} } },
    };
    const fn = new Function("window", "document", "navigator", "localStorage", "matchMedia",
      THEME_INIT_SCRIPT.replace("(() => {", "return (() => {").replace("})();", "})();"));
    fn(g, g.document, g.navigator, g.localStorage, g.matchMedia);
    expect(g.document.documentElement.classList.toggle).toHaveBeenCalledWith("dark", true);
  });

  it("init script adds low-end class on reduced-motion devices", () => {
    const g = {
      localStorage: { getItem: () => null },
      matchMedia: (q: string) => ({ matches: q.includes("reduced-motion") }),
      navigator: {},
      document: { documentElement: { classList: { toggle: vi.fn(), add: vi.fn() }, style: {} } },
    };
    const fn = new Function("window", "document", "navigator", "localStorage", "matchMedia",
      THEME_INIT_SCRIPT.replace("(() => {", "return (() => {").replace("})();", "})();"));
    fn(g, g.document, g.navigator, g.localStorage, g.matchMedia);
    expect(g.document.documentElement.classList.add).toHaveBeenCalledWith("low-end-device");
  });

  it("storage event applies cross-window theme without writing back", () => {
    render(<ThemeToggle />);
    window.localStorage.setItem("onpoint-theme", "dark");
    const setSpy = vi.spyOn(Storage.prototype, "setItem");
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "onpoint-theme", newValue: "dark" }));
    });
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(setSpy).not.toHaveBeenCalled();
  });

});
