import type { Metadata } from "next";
import { CoupleClient } from "./CoupleClient";
import { loadLookOptions } from "@/lib/looks/load-looks";

export const metadata: Metadata = {
  title: "Couple goals — style the two of you | OnPoint",
  description: "One photo of the two of you + a look. A card worth sending.",
};

export default async function CouplePage() {
  const looks = await loadLookOptions();
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <main className="mx-auto max-w-xl px-4 pb-20 pt-14 md:pt-20">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-primary">
          Couple goals
        </p>
        <h1 className="mt-3 font-display text-4xl leading-[1.05] tracking-[-0.02em] sm:text-5xl">
          One photo of you two.
          <span className="block text-primary">One look.</span>
        </h1>
        <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
          Make a card worth sending — and the pieces on it are shoppable.
        </p>
        <div className="mt-8">
          {looks.length > 0 ? (
            <CoupleClient looks={looks} />
          ) : (
            <div className="border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              No looks to style with yet — new ones land soon.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
