import type { Metadata } from "next";
import { MagazineClient } from "./MagazineClient";
import { loadLookOptions } from "@/lib/looks/load-looks";

export const metadata: Metadata = {
  title: "Send her a magazine | OnPoint",
  description: "A personal fashion magazine — she's the cover, the pieces are real.",
};

export default async function MagazinePage({ searchParams }: { searchParams: Promise<{ reply?: string }> }) {
  const { reply } = await searchParams;
  const looks = await loadLookOptions();
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <main className="mx-auto max-w-xl px-4 pb-20 pt-14 md:pt-20">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-primary">The issue of one</p>
        <h1 className="mt-3 font-display text-4xl leading-[1.05] tracking-[-0.02em] sm:text-5xl">
          A magazine, made for her.
        </h1>
        <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
          Her name on the cover. Real pieces inside. A note on the back page. Send the link — it opens like a magazine, not a checkout.
        </p>
        <div className="mt-8">
          {looks.length > 0 ? (
            <MagazineClient looks={looks} replyTo={reply || null} />
          ) : (
            <div className="border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              No pieces to feature yet — new stock lands soon.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
