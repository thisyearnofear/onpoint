import { Suspense } from "react";
import { permanentRedirect } from "next/navigation";
import { TacticalDashboard } from "@/components/Dashboard/TacticalDashboard";

// The lab is one surface. The slugs that used to name a tab are retired in
// next.config.js's redirects(), which answers a real 308; this page only has to
// catch a mode nothing links to any more and still land it on the fitting room.
export default async function LabModePage({ params }: { params: Promise<{ mode: string }> }) {
  const { mode } = await params;
  if (mode !== "try-on") permanentRedirect("/lab/try-on");

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-live="polite">
          <span className="text-sm font-semibold text-muted-foreground">Opening the fitting room…</span>
        </div>
      }
    >
      <TacticalDashboard />
    </Suspense>
  );
}
