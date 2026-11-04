import React from "react";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.ComponentProps<"a">) =>
    <a href={href} {...props}>{children}</a>,
}));
vi.mock("framer-motion", () => ({
  useReducedMotion: () => true,
  motion: { div: (props: React.ComponentProps<"div">) => <div {...props} /> },
}));

import { RunwayPlay } from "../runway/RunwayPlay";
import { JudgeAvatar } from "../runway/JudgeAvatar";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Runway navigation continuity", () => {
  it("opens the real intro without creating a round or sending a photo", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("Unexpected request"));
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<RunwayPlay />);
    await act(async () => {});
    expect(screen.getByText("Pick your judge")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Miranda" })).toBeTruthy();
    expect(container.querySelector(".dark")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses valid theme classes in the actual Runway component source", () => {
    // Read from the project root (vitest is run from apps/web) because
    // import.meta.url is not a file: URL under the jsdom test environment.
    // Markup lives in RunwayPlay.tsx and the per-stage files under runway/play/.
    const dir = resolve(process.cwd(), "components/runway/play");
    const files = [
      resolve(process.cwd(), "components/runway/RunwayPlay.tsx"),
      ...readdirSync(dir).filter((f) => f.endsWith(".tsx")).map((f) => resolve(dir, f)),
    ];
    expect(files.length).toBeGreaterThan(5);
    for (const file of files) {
      expect(readFileSync(file, "utf8"), file).not.toContain("text-foreground0");
    }
  });

  it.each([
    ["miranda", "slate"],
    ["edina", "purple"],
    ["shaft", "orange"],
  ])("keeps %s readable in both themes", (persona, color) => {
    const html = renderToStaticMarkup(<JudgeAvatar persona={persona} />);
    expect(html).toContain(`text-${color}-700`);
    expect(html).toContain(`dark:text-${color}-300`);
  });
});
