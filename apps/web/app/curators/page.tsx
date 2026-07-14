import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  Package,
  Sparkles,
  Store,
  Users,
} from "lucide-react";
import { CuratorDirectoryClient } from "./CuratorDirectoryClient";
import { getApiBase } from "../../lib/utils/api-base";
import { OnPointHeader } from "../../components/OnPointHeader";

export const metadata: Metadata = {
  title: "Browse Curators | OnPoint",
  description:
    "Discover fashion curators on OnPoint. Browse storefronts by vertical — football kits, streetwear, formal, and more. Try on items with AI before you buy.",
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

// Collect all unique verticals for the filter chips
function collectVerticals(curators: DirectoryCurator[]): string[] {
  const set = new Set<string>();
  for (const c of curators) {
    for (const v of c.verticals ?? []) set.add(v);
  }
  return Array.from(set).sort();
}

export default async function CuratorsPage() {
  const curators = await loadDirectory();
  const verticals = collectVerticals(curators);

  return (
    <div className="min-h-screen bg-background">
      <OnPointHeader />

      {/* ── Header ── */}
      <header className="border-b border-border bg-gradient-to-b from-muted/30 to-background">
        <div className="container mx-auto px-4 py-10 md:py-16 max-w-5xl">
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
                Discover fashion curators with live storefronts. Try on items
                with AI, then checkout via WhatsApp.
              </p>
            </div>
          </div>

          {/* Stats strip */}
          <div className="mt-6 flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="w-4 h-4" />
              <span className="font-bold text-foreground">{curators.length}</span>
              curator{curators.length !== 1 ? "s" : ""}
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Package className="w-4 h-4" />
              <span className="font-bold text-foreground">
                {curators.reduce((sum, c) => sum + (c.liveListingCount || 0), 0)}
              </span>
              live listings
            </div>
            {verticals.length > 0 && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Sparkles className="w-4 h-4" />
                <span className="font-bold text-foreground">{verticals.length}</span>
                verticals
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Directory ── */}
      <main className="container mx-auto px-4 py-8 md:py-12 max-w-5xl">
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
          <CuratorDirectoryClient
            curators={curators.map((c) => ({
              ...c,
              // Serialize dates for client component
              createdAt: String(c.createdAt),
            }))}
            verticals={verticals}
          />
        )}
      </main>

      {/* ── Footer CTA ── */}
      <footer className="border-t border-border mt-8">
        <div className="container mx-auto px-4 py-10 max-w-5xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-bold text-foreground">Are you a fashion curator?</p>
            <p className="text-sm text-muted-foreground">
              Open your free storefront in minutes.
            </p>
          </div>
          <Link
            href="/curator"
            className="inline-flex items-center gap-2 border border-border bg-card hover:bg-muted text-foreground font-bold px-5 py-2.5 rounded-full transition-colors"
          >
            Become a Curator
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </footer>
    </div>
  );
}
