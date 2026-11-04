import type { Metadata } from "next";
import { Suspense } from "react";
import { RunwayPlay } from "@/components/runway/RunwayPlay";

export const metadata: Metadata = {
  title: "Play Runway | OnPoint",
};

export default function RunwayPlayPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-live="polite">
          <span className="text-sm font-semibold text-muted-foreground">Opening Runway…</span>
        </div>
      }
    >
      <RunwayPlay />
    </Suspense>
  );
}
