import { describe, expect, it, vi, beforeEach } from "vitest";

const { permanentRedirect } = vi.hoisted(() => {
  const fn = vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  });
  return { permanentRedirect: fn };
});

vi.mock("next/navigation", () => ({ permanentRedirect }));
vi.mock("@/components/Dashboard/TacticalDashboard", () => ({
  TacticalDashboard: () => null,
}));

import LabModePage from "../page";

const TABLE: Array<[string, string]> = [
  ["stylist", "/lab/try-on#ask-stylist"],
  ["saved", "/lab/try-on#your-try-ons"],
  ["settings", "/lab/try-on#settings"],
  ["dashboard", "/lab/try-on"],
  ["shop", "/shop"],
  // Anything else has no panel to open: it lands on the fitting room.
  ["hauling", "/lab/try-on"],
  // Object.prototype must not read as a retired mode.
  ["constructor", "/lab/try-on"],
];

const visit = (mode: string) => LabModePage({ params: Promise.resolve({ mode }) });

describe("/lab/[mode] — retired tabs redirect, the fitting room serves", () => {
  // Braces matter: returning the mock would register it as a teardown hook.
  beforeEach(() => {
    permanentRedirect.mockClear();
  });

  it.each(TABLE)("%s lands on %s", async (mode, target) => {
    await visit(mode).catch(() => null);
    expect(permanentRedirect).toHaveBeenCalledWith(target);
  });

  it("renders the fitting room at try-on without redirecting", async () => {
    await expect(visit("try-on")).resolves.toBeTruthy();
    expect(permanentRedirect).not.toHaveBeenCalled();
  });
});
