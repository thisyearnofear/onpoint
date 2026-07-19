import Link from "next/link";
import { Shirt } from "lucide-react";
import { getApiBase } from "../../lib/utils/api-base";
import { OnPointLayout } from "../../components/OnPointLayout";
import { LookCard, type LookCardData } from "../../components/LookCard";

export const dynamic = "force-dynamic";

async function loadLooks(tag?: string): Promise<LookCardData[]> {
  try {
    const params = new URLSearchParams({ limit: "24" });
    if (tag) params.set("tag", tag);
    const res = await fetch(`${getApiBase()}/api/looks?${params}`, {
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

export default async function LooksPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  const { tag } = await searchParams;
  const looks = await loadLooks(tag);

  return (
    <OnPointLayout footer={false}>
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

        {/* Tag filter chips */}
        <div className="mb-8 flex flex-wrap gap-2">
          <Link
            href="/looks"
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              !tag
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            All
          </Link>
          {POPULAR_TAGS.map((t) => (
            <Link
              key={t}
              href={`/looks?tag=${t}`}
              className={`rounded-full px-3 py-1 text-sm font-medium capitalize transition-colors ${
                tag === t
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {t}
            </Link>
          ))}
        </div>

        {looks.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-20 text-center">
            <Shirt className="mb-4 h-12 w-12 text-muted-foreground/30" />
            <h2 className="text-lg font-bold">
              {tag ? `No looks tagged "${tag}"` : "No looks yet"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {tag
                ? "Try a different tag or browse all looks."
                : "Agent-composed style boards will appear here."}
            </p>
            {tag && (
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
