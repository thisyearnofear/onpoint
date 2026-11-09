import type { Metadata } from "next";
import { PairMakerClient } from "./PairMakerClient";

export const metadata: Metadata = {
  title: "Same fit, both of us — make a pair card | OnPoint",
  description: "Try on a garment, send the link, they try it on too. One card, both of you.",
};

export default async function PairPage({
  searchParams,
}: {
  searchParams: Promise<{ item?: string; from?: string }>;
}) {
  const { item, from } = await searchParams;
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <main className="mx-auto max-w-xl px-4 pb-20 pt-14 md:pt-20">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-primary">
          Pair check
        </p>
        <h1 className="mt-3 font-display text-4xl leading-[1.05] tracking-[-0.02em] sm:text-5xl">
          Same fit.
          <span className="block text-primary">Both of us.</span>
        </h1>
        <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
          Try it on you, send the link, they try it on too — one card worth sending back.
        </p>
        <div className="mt-8">
          <PairMakerClient itemId={item ?? null} fromSlug={from ?? null} />
        </div>
      </main>
    </div>
  );
}
