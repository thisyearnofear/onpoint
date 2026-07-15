import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  Camera,
  Package,
  Sparkles,
  Store,
  Users,
  Eye,
  Shirt,
  Clock,
} from "lucide-react";
import { getApiBase } from "../../lib/utils/api-base";
import { OnPointHeader } from "../../components/OnPointHeader";

export const metadata: Metadata = {
  title: "Browse Curators | OnPoint",
  description:
    "Discover fashion curators on OnPoint. Try on AI designs from Nia Digital, browse football kits from Wanja, and more curators coming soon.",
};

export const dynamic = "force-dynamic";

interface DirectoryCurator {
  slug: string;
  name: string;
  type: "human" | "ai";
  verticals: string[];
  brand?: {
    logo?: string;
    colors?: { primary?: string; accent?: string };
    location?: { city: string; landmark?: string };
  };
  channels?: {
    whatsapp?: string;
    telegram?: string;
    instagram?: string;
  };
  createdAt: string;
  liveListingCount: number;
  digitalListingCount?: number;
}

async function loadDirectory(): Promise<DirectoryCurator[]> {
  try {
    const res = await fetch(
      `${getApiBase()}/api/curator/directory`,
      { cache: "no-store" },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.curators ?? [];
  } catch {
    return [];
  }
}

export default async function CuratorsPage() {
  const curators = await loadDirectory();

  // Split into live vs coming soon
  const liveCurators = curators.filter((c) => c.liveListingCount > 0 || (c.digitalListingCount ?? 0) > 0);
  const comingSoon = curators.filter((c) => c.liveListingCount === 0 && (c.digitalListingCount ?? 0) === 0);

  // Featured: Nia (AI, digital try-on)
  const nia = liveCurators.find((c) => c.slug === "nia");
  const wanja = liveCurators.find((c) => c.slug === "wanja");
  const otherLive = liveCurators.filter((c) => c.slug !== "nia" && c.slug !== "wanja");

  const totalListings = curators.reduce((sum, c) => sum + (c.liveListingCount || 0), 0);

  return (
    <div className="min-h-screen bg-background">
      <OnPointHeader />

      {/* ── Header ── */}
      <header className="border-b border-border bg-gradient-to-b from-muted/30 to-background">
        <div className="container mx-auto px-4 py-10 md:py-14 max-w-4xl">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-4">
            <Link href="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
            <span>/</span>
            <span className="text-foreground">Curators</span>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 shrink-0">
              <Store className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground">
                Browse Curators
              </h1>
              <p className="mt-2 text-muted-foreground text-sm md:text-base max-w-xl">
                Try on AI designs from Nia Digital, browse football kits from Wanja, and more curators coming soon.
              </p>
            </div>
          </div>

          {/* Stats strip */}
          <div className="mt-6 flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="w-4 h-4" />
              <span className="font-bold text-foreground">{liveCurators.length}</span>
              live now
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Package className="w-4 h-4" />
              <span className="font-bold text-foreground">{totalListings}</span>
              listings
            </div>
            {comingSoon.length > 0 && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span className="font-bold text-foreground">{comingSoon.length}</span>
                coming soon
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 md:py-12 max-w-4xl">
        {curators.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-muted/40 mb-4">
              <Store className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">
              No curators yet
            </h2>
            <p className="text-muted-foreground text-sm max-w-md mb-6">
              Be the first to open a storefront on OnPoint. It&apos;s free — no
              credit card, no code, just your fashion eye.
            </p>
            <Link
              href="/curator"
              className="inline-flex items-center gap-2 bg-primary text-white font-bold px-6 py-3 rounded-full hover:bg-primary/90 transition-colors"
            >
              Become a Curator
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-12">
            {/* ── Featured: Nia Digital ── */}
            {nia && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    Featured — Try on now
                  </h2>
                </div>
                <Link
                  href={`/s/${nia.slug}`}
                  className="group block rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/[0.04] to-transparent p-6 md:p-8 transition-all hover:border-primary/50 hover:shadow-lg"
                >
                  <div className="flex flex-col md:flex-row gap-6">
                    {/* Visual */}
                    <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 text-4xl font-black text-primary">
                      {nia.brand?.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={nia.brand.logo} alt={nia.name} className="h-full w-full rounded-2xl object-cover" />
                      ) : (
                        "ND"
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-black tracking-tight">{nia.name}</h3>
                        <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                          <Sparkles className="w-2.5 h-2.5" />
                          AI Curator
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        AI-generated fashion designs. Try on any piece in seconds — free, no wallet required.
                      </p>

                      {/* Stats */}
                      <div className="flex flex-wrap gap-3">
                        <div className="flex items-center gap-1.5 text-sm">
                          <Shirt className="w-4 h-4 text-muted-foreground" />
                          <span className="font-bold">{nia.digitalListingCount || nia.liveListingCount}</span>
                          <span className="text-muted-foreground">designs</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm">
                          <Eye className="w-4 h-4 text-muted-foreground" />
                          <span className="font-bold">Free</span>
                          <span className="text-muted-foreground">try-on</span>
                        </div>
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1.5">
                        {nia.verticals.slice(0, 4).map((v) => (
                          <span
                            key={v}
                            className="rounded-full border border-border px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground capitalize"
                          >
                            {v.replaceAll("-", " ")}
                          </span>
                        ))}
                      </div>

                      {/* CTA */}
                      <div className="pt-2">
                        <span className="inline-flex items-center gap-2 bg-primary text-white font-bold px-5 py-2.5 rounded-full text-sm group-hover:gap-3 transition-all">
                          <Camera className="w-4 h-4" />
                          Try on now — it&apos;s free
                          <ArrowRight className="w-4 h-4" />
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </section>
            )}

            {/* ── Also live: Wanja + others ── */}
            {(wanja || otherLive.length > 0) && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Store className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    Also live
                  </h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {[wanja, ...otherLive].filter(Boolean).map((curator) => (
                    <Link
                      key={curator!.slug}
                      href={`/s/${curator!.slug}`}
                      className="group rounded-xl border border-border/40 bg-card p-5 transition-all hover:border-border hover:shadow-md"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-black text-white"
                          style={{
                            background: curator!.brand?.colors?.primary
                              ? `linear-gradient(135deg, ${curator!.brand.colors.primary}, ${curator!.brand.colors.accent ?? curator!.brand.colors.primary})`
                              : "hsl(var(--primary))",
                          }}
                        >
                          {curator!.brand?.logo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={curator!.brand.logo} alt={curator!.name} className="h-full w-full rounded-xl object-cover" />
                          ) : (
                            curator!.name.charAt(0)
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold truncate">{curator!.name}</h3>
                          {curator!.brand?.location?.city && (
                            <p className="text-xs text-muted-foreground">{curator!.brand.location.city}</p>
                          )}
                          <div className="mt-2 flex items-center gap-2 text-xs">
                            <span className="font-bold">{curator!.liveListingCount}</span>
                            <span className="text-muted-foreground">live listings</span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {curator!.verticals.slice(0, 3).map((v) => (
                              <span
                                key={v}
                                className="rounded-full bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground capitalize"
                              >
                                {v.replaceAll("-", " ")}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* ── Coming soon ── */}
            {comingSoon.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    Coming soon
                  </h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {comingSoon.map((curator) => (
                    <div
                      key={curator.slug}
                      className="rounded-xl border border-dashed border-border/40 bg-muted/10 p-4 opacity-60"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-muted-foreground grayscale"
                          style={{
                            background: curator.brand?.colors?.primary
                              ? `${curator.brand.colors.primary}30`
                              : "hsl(var(--muted))",
                          }}
                        >
                          {curator.brand?.logo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={curator.brand.logo} alt={curator.name} className="h-full w-full rounded-lg object-cover grayscale" />
                          ) : (
                            curator.name.charAt(0)
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-sm truncate">{curator.name}</h3>
                          {curator.brand?.location?.city && (
                            <p className="text-xs text-muted-foreground">{curator.brand.location.city}</p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-1">
                            {curator.verticals.slice(0, 2).map((v) => (
                              <span
                                key={v}
                                className="rounded-full bg-muted/30 px-1.5 py-0.5 text-[10px] text-muted-foreground capitalize"
                              >
                                {v.replaceAll("-", " ")}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Become a curator CTA ── */}
            <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.03] to-transparent p-6 md:p-8 text-center">
              <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-2xl bg-primary/10 mb-3">
                <Store className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-lg font-black tracking-tight">Are you a fashion curator?</h2>
              <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                Open your free storefront in minutes. AI try-on, polaroid sharing, and on-chain payments — no code required.
              </p>
              <Link
                href="/curator"
                className="mt-4 inline-flex items-center gap-2 bg-primary text-white font-bold px-6 py-3 rounded-full text-sm hover:bg-primary/90 transition-colors"
              >
                Become a Curator
                <ArrowRight className="w-4 h-4" />
              </Link>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
