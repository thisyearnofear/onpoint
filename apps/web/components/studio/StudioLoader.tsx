"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/state";

const StudioShell = dynamic(
  () => import("@/components/studio/StudioShell").then((m) => m.StudioShell),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[78vh] w-full" />,
  },
);

export function StudioLoader() {
  return <StudioShell />;
}
