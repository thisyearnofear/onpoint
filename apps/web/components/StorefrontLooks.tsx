/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { Eye, Shirt, Sparkles } from "lucide-react";
import { getApiBase } from "../lib/utils/api-base";

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
  tags: string[];
  tryOnCount: number;
  purchaseCount: number;
  shareCount: number;
  items: LookItem[];
}

async function loadLooksForCurator(slug: string): Promise<Look[]> {
  try {
    const res = await fetch(
      `${getApiBase()}/api/looks?curator=${encodeURIComponent(slug)}&limit=6`,
      { cache: "no-store" },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.looks || [];
  } catch {
    return [];
  }
}

export async function StorefrontLooks({ curatorSlug }: { curatorSlug: string }) {
  const looks = await loadLooksForCurator(curatorSlug);

  if (looks.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <Sparkles className="h-5 w-5 text-foreground/60" />
            Styled Looks
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Style boards featuring this curator&apos;s collection — created by agents. Try on and share.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {looks.map((look) => {
          const items = look.items || [];
          const heroItem = items.find((i) => i.isHero) || items[0];
          const agentShort = look.agentAddress
            ? `${look.agentAddress.slice(0, 6)}…${look.agentAddress.slice(-4)}`
            : "unknown";

          return (
            <Link
              key={look.id}
              href={`/look/${look.slug}`}
              className="group overflow-hidden rounded-xl border border-border transition-all hover:border-foreground/20 hover:shadow-md"
            >
              {/* Cover image */}
              <div className="relative aspect-[4/5] overflow-hidden bg-muted">
                {heroItem?.imageUrl ? (
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

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                {/* Tag badges */}
                <div className="absolute top-3 left-3 flex flex-wrap gap-1">
                  {look.tags.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium capitalize text-white backdrop-blur"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Try-on count */}
                <div className="absolute top-3 right-3 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {look.tryOnCount}
                  </span>
                </div>

                {/* Title + attribution */}
                <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                  <h3 className="text-sm font-bold leading-tight">{look.title}</h3>
                  <p className="mt-0.5 text-[11px] text-white/70">
                    Styled by {agentShort}
                  </p>
                </div>
              </div>

              {/* Item count */}
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-xs text-muted-foreground">
                  {items.length} pieces
                </span>
                <span className="text-xs font-medium text-foreground/60 transition-colors group-hover:text-foreground">
                  View look →
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
