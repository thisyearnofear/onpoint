import { Suspense } from "react";
import { permanentRedirect } from "next/navigation";
import { TacticalDashboard } from "@/components/Dashboard/TacticalDashboard";

// The lab is one surface. These slugs used to name a tab; the panel they
// opened is now a disclosure on the fitting room, so the URL still arrives
// there. 301 because these were shared and bookmarked.
const RETIRED_MODES: Record<string, string> = {
  stylist: "/lab/try-on#ask-stylist",
  saved: "/lab/try-on#your-try-ons",
  settings: "/lab/try-on#settings",
  dashboard: "/lab/try-on",
  shop: "/shop",
};

export default async function LabModePage({ params }: { params: Promise<{ mode: string }> }) {
  const { mode } = await params;
  if (mode !== "try-on") {
    const retired = Object.hasOwn(RETIRED_MODES, mode) ? RETIRED_MODES[mode] : undefined;
    permanentRedirect(retired ?? "/lab/try-on");
  }

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
