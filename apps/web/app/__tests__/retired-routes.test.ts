import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";
import sitemap from "@/app/sitemap";

type Redirect = { source: string; destination: string; permanent: boolean };

// vitest runs from apps/web; import.meta.url is an http URL under jsdom.
const appDir = resolve(process.cwd(), "app");

async function redirects(): Promise<Redirect[]> {
  return (await nextConfig.redirects!()) as Redirect[];
}

describe("retired URLs", () => {
  it("redirects /style-guide permanently, at the config layer", async () => {
    const entry = (await redirects()).find((r) => r.source === "/style-guide");
    expect(entry).toEqual({ source: "/style-guide", destination: "/about", permanent: true });
  });

  // Two ways a page-level permanentRedirect() ships a 200 instead of the
  // permanent status: a page that takes no searchParams runs during static
  // generation, where Next swallows the throw and prerenders its error shell;
  // and a page under a client layout — anything inside app/(consumer) — whose
  // shell flushes before the page runs, so Next can only emit a
  // <meta http-equiv="refresh">. (/looks and /style-board get a real 308
  // because they await searchParams AND sit outside that layout.) A route the
  // config already redirects must therefore have no page — otherwise the page
  // is dead and the 308 is a rumor.
  it("does not also keep a page for a config-redirected route", async () => {
    for (const entry of await redirects()) {
      if (entry.source.includes(":path*")) continue;
      const page = resolve(appDir, entry.source.slice(1), "page.tsx");
      expect({ source: entry.source, exists: existsSync(page) }).toEqual({
        source: entry.source,
        exists: false,
      });
    }
  });

  // The lab's retired tab slugs were bookmarked and shared, so their status has
  // to be permanent — which means the config, not the page. Each destination
  // carries the hash TacticalDashboard's panelForHash reads to open the panel.
  it("carries every retired lab tab onto the fitting room", async () => {
    const table = Object.fromEntries(
      (await redirects())
        .filter((r) => r.source.startsWith("/lab/"))
        .map((r) => [r.source, r.destination]),
    );
    expect(table).toEqual({
      "/lab/stylist": "/lab/try-on#ask-stylist",
      "/lab/saved": "/lab/try-on#your-try-ons",
      "/lab/settings": "/lab/try-on#settings",
      "/lab/dashboard": "/lab/try-on",
      "/lab/shop": "/shop",
    });
  });

  it("publishes none of them, so a crawler never rides a permanent hop", async () => {
    const paths = new Set((await sitemap()).map((entry) => new URL(entry.url).pathname));
    for (const retired of ["/style-guide", "/looks", "/style-board", "/style", "/collage", "/social"]) {
      expect(paths.has(retired)).toBe(false);
    }
  });
});
