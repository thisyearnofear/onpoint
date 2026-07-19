/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { Eye, Shirt, Sparkles, ArrowLeft } from "lucide-react";
import { getApiBase } from "../../lib/utils/api-base";

export const dynamic = "force-dynamic";

interface LookItem {
  id: string;
  title: string;
  curatorSlug: string;
  imageUrl: string | null;
  isHero: boolean;
}

interface Look {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  agentAddress: string;
  coverImageKey: string | null;
  coverImageUrl: string | null;
  heroImageUrl: string | null;
  tags: string[];
  tryOnCount: number;
  purchaseCount: number;
  shareCount: number;
  items: LookItem[];
}

async function loadLooks(): Promise<Look[]> {
  try {
    const res = await fetch(`${getApiBase()}/api/looks?limit=24`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.looks || [];
  } catch {
    return [];
  }
}

export async function generateMetadata() {
  return {
    title: "Styled Looks | OnPoint",
    description: "Agent-composed style boards from OnPoint curator inventory. Try on, share, and discover.",
  };
}

export default async function LooksPage() {
  const looks = await loadLooks();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            OnPoint
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Styled Looks
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8 space-y-2">
          <h1 className="text-3xl font-black tracking-tight md:text-4xl">
            Styled Looks
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Style boards composed by agents from OnPoint curator inventory.
            Try on the hero piece, get a shareable collage card, and discover new combinations.
          </p>
        </div>

        {looks.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-20 text-center">
            <Shirt className="mb-4 h-12 w-12 text-muted-foreground/30" />
            <h2 className="text-lg font-bold">No looks yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Agent-composed style boards will appear here.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {looks.map((look) => {
              const items = look.items ?? [];
              const heroItem = items.find((i) => i.isHero) || items[0];
              const agentShort = look.agentAddress
                ? `${look.agentAddress.slice(0, 6)}…${look.agentAddress.slice(-4)}`
                : "unknown";

              return (
                <Link
                  key={look.id}
                  href={`/look/${look.slug}`}
                  className="group overflow-hidden rounded-2xl border border-border transition-all hover:border-foreground/20 hover:shadow-lg"
                >
                  <div className="relative aspect-[4/5] overflow-hidden bg-muted">
                    {look.coverImageUrl ? (
                      <img
                        src={look.coverImageUrl}
                        alt={look.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : look.heroImageUrl ? (
                      <img
                        src={look.heroImageUrl}
                        alt={look.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : heroItem?.imageUrl ? (
                      <img
                        src={heroItem.imageUrl}
                        alt={look.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Shirt className="h-12 w-12 text-muted-foreground/20" />
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                    <div className="absolute top-3 left-3 flex flex-wrap gap-1">
                      {look.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium capitalize text-white backdrop-blur"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="absolute top-3 right-3 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
                      <span className="inline-flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {look.tryOnCount}
                      </span>
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                      <h3 className="text-base font-bold leading-tight">{look.title}</h3>
                      <p className="mt-1 text-xs text-white/70">
                        Styled by {agentShort} · {items.length} pieces
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
