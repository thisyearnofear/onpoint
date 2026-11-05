"use client";

import { Suspense } from "react";
import { TacticalDashboard } from "@/components/Dashboard/TacticalDashboard";

export function LabModeClient({ initialMode }: { initialMode: string }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-live="polite">
          <span className="text-sm font-semibold text-muted-foreground">Opening the fitting room…</span>
        </div>
      }
    >
      <TacticalDashboard initialMode={initialMode} onBack={() => window.history.back()} />
    </Suspense>
  );
}
