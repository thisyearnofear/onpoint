import type { Metadata } from "next";
import { Suspense } from "react";
import { RunwayPlay } from "../../../components/runway/RunwayPlay";

export const metadata: Metadata = {
  title: "Play Runway | OnPoint",
};

export default function RunwayPlayPage() {
  return (
    <Suspense>
      <RunwayPlay />
    </Suspense>
  );
}
