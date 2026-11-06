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

  // A permanentRedirect() in a page that takes no searchParams runs during
  // static generation, where Next swallows it and prerenders its error shell as
  // a 200. (/looks and /style-board avoid this only because they await
  // searchParams, which keeps them dynamic.) A route the config already
  // redirects must therefore have no page — otherwise the page is dead and the
  // 308 is a rumor.
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

  it("publishes none of them, so a crawler never rides a permanent hop", async () => {
    const paths = new Set((await sitemap()).map((entry) => new URL(entry.url).pathname));
    for (const retired of ["/style-guide", "/looks", "/style-board", "/style", "/collage", "/social"]) {
      expect(paths.has(retired)).toBe(false);
    }
  });
});
