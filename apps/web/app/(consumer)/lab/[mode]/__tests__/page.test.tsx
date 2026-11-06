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

// The slugs people actually linked — /lab/stylist, /saved, /settings, /dashboard,
// /shop — are retired by next.config.js's redirects(), which is the only layer
// that answers a real 308 from inside the consumer layout; retired-routes.test.ts
// locks that table. What is left here is the catch-all a config entry cannot
// express: a mode nothing names any more still has to land somewhere.
const FALLBACK_MODES = ["hauling", "constructor"];

const visit = (mode: string) => LabModePage({ params: Promise.resolve({ mode }) });

describe("/lab/[mode] — the fitting room serves, an unknown mode falls back", () => {
  // Braces matter: returning the mock would register it as a teardown hook.
  beforeEach(() => {
    permanentRedirect.mockClear();
  });

  it.each(FALLBACK_MODES)("%s lands on the fitting room", async (mode) => {
    await visit(mode).catch(() => null);
    expect(permanentRedirect).toHaveBeenCalledWith("/lab/try-on");
  });

  it("renders the fitting room at try-on without redirecting", async () => {
    await expect(visit("try-on")).resolves.toBeTruthy();
    expect(permanentRedirect).not.toHaveBeenCalled();
  });
});
