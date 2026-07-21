import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function LooksHeader() {
  return (
    <div className="mb-6">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Home
      </Link>

      <div className="mb-8 mt-6 space-y-3">
        <h1 className="text-3xl font-black tracking-tight md:text-4xl">
          Outfits curated for you
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Browse real looks from OnPoint curators. Tap any outfit to try it on
          with AI, then shop the pieces.
        </p>
      </div>
    </div>
  );
}
