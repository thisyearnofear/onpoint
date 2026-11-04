import type { Metadata } from "next";
import { Suspense } from "react";
import { OnPointFooter } from "@/components/OnPointHeader";
import { StyleBoard } from "@/components/style-board/StyleBoard";

export const metadata: Metadata = {
  title: "The Style Board — outfit inspo | OnPoint",
  description: "Curated AI-generated outfit references. Pick a look, send it to the Runway judges, or bring your own fit.",
};

export default function StyleBoardPage() {
  return (
    <>
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-live="polite">
            <span className="text-sm font-semibold text-muted-foreground">Opening the style board…</span>
          </div>
        }
      >
        <StyleBoard />
      </Suspense>
      <OnPointFooter />
    </>
  );
}
