import Link from "next/link";
import { ArrowLeft, Shirt } from "lucide-react";
import { getApiBase } from "../../lib/utils/api-base";
import { OnPointLayout } from "../../components/OnPointLayout";
import { LookCard, type LookCardData } from "../../components/LookCard";

export const dynamic = "force-dynamic";

async function loadLooks(params: {
  tag?: string;
  category?: string;
  occasion?: string;
  season?: string;
}): Promise<LookCardData[]> {
  try {
    const qs = new URLSearchParams({ limit: "24" });
    if (params.tag) qs.set("tag", params.tag);
    if (params.category) qs.set("category", params.category);
    if (params.occasion) qs.set("occasion", params.occasion);
    if (params.season) qs.set("season", params.season);
    const res = await fetch(`${getApiBase()}/api/looks?${qs}`, {
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

const POPULAR_TAGS = ["streetwear", "casual", "event", "ankara", "vintage", "formal"];

const CATEGORIES = [
  { value: "streetwear", label: "Streetwear" },
  { value: "casual", label: "Casual" },
  { value: "formal", label: "Formal" },
  { value: "event", label: "Event" },
  { value: "sport", label: "Sport" },
  { value: "vintage", label: "Vintage" },
  { value: "ankara", label: "Ankara" },
  { value: "sustainable", label: "Sustainable" },
];

const OCCASIONS = ["casual", "formal", "event", "sport", "outdoor", "travel", "date-night"];
const SEASONS = ["spring", "summer", "fall", "winter"];

export default async function LooksPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; category?: string; occasion?: string; season?: string }>;
}) {
  const { tag, category, occasion, season } = await searchParams;
  const looks = await loadLooks({ tag, category, occasion, season });

  const hasFilter = tag || category || occasion || season;

  return (
    <OnPointLayout footer={false}>
      <div className="mx-auto max-w-6xl px-4 py-10">
        {/* Back link */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Home
          </Link>
        </div>

        <div className="mb-8 space-y-2">
          <h1 className="text-3xl font-black tracking-tight md:text-4xl">
            Styled Looks
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Style boards composed by agents from OnPoint curator inventory.
            Try on the hero piece, get a shareable collage card, and discover new combinations.
          </p>
        </div>

        {/* Category filter chips */}
        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            href="/looks"
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              !hasFilter
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            All
          </Link>
          {CATEGORIES.map((c) => (
            <Link
              key={c.value}
              href={`/looks?category=${c.value}`}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                category === c.value
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {c.label}
            </Link>
          ))}
        </div>

        {/* Occasion + Season filters (secondary row) */}
        <div className="mb-8 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60">
            Occasion
          </span>
          {OCCASIONS.map((o) => (
            <Link
              key={o}
              href={`/looks?occasion=${o}`}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize transition-colors ${
                occasion === o
                  ? "bg-foreground/80 text-background"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}
            >
              {o.replace("-", " ")}
            </Link>
          ))}
          <span className="ml-3 text-xs font-bold uppercase tracking-wider text-muted-foreground/60">
            Season
          </span>
          {SEASONS.map((s) => (
            <Link
              key={s}
              href={`/looks?season=${s}`}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize transition-colors ${
                season === s
                  ? "bg-foreground/80 text-background"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}
            >
              {s}
            </Link>
          ))}
        </div>

        {/* Tag filters (tertiary, only show when no category filter is active) */}
        {!category && (
          <div className="mb-8 flex flex-wrap gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60">
              Tags
            </span>
            {POPULAR_TAGS.map((t) => (
              <Link
                key={t}
                href={`/looks?tag=${t}`}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize transition-colors ${
                  tag === t
                    ? "bg-foreground/80 text-background"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted"
                }`}
              >
                {t}
              </Link>
            ))}
          </div>
        )}

        {looks.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-20 text-center">
            <Shirt className="mb-4 h-12 w-12 text-muted-foreground/30" />
            <h2 className="text-lg font-bold">
              {hasFilter ? "No looks match your filters" : "No looks yet"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasFilter
                ? "Try a different filter or browse all looks."
                : "Agent-composed style boards will appear here."}
            </p>
            {hasFilter && (
              <Link
                href="/looks"
                className="mt-4 text-sm font-medium text-foreground underline"
              >
                Browse all looks →
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {looks.map((look) => (
              <LookCard key={look.id} look={look} />
            ))}
          </div>
        )}
      </div>
    </OnPointLayout>
  );
}
