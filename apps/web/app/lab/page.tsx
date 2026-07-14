"use client";

import { TacticalDashboard } from "../../components/Dashboard/TacticalDashboard";
import { OnPointHeader } from "../../components/OnPointHeader";

export default function LabPage() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      <OnPointHeader />
      <TacticalDashboard onBack={() => window.history.back()} />
    </div>
  );
}
