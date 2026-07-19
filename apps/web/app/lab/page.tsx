"use client";

import { TacticalDashboard } from "../../components/Dashboard/TacticalDashboard";
import { OnPointLayout } from "../../components/OnPointLayout";

export default function LabPage() {
  return (
    <OnPointLayout footer={false}>
      <TacticalDashboard onBack={() => window.history.back()} />
    </OnPointLayout>
  );
}
