import type { Metadata } from "next";
import { Suspense } from "react";
import { OnPointLayout } from "../../components/OnPointLayout";
import { StyleBoard } from "../../components/style-board/StyleBoard";

export const metadata: Metadata = {
  title: "The Style Board — outfit inspo | OnPoint",
  description: "Curated AI-generated outfit references. Pick a look, send it to the Runway judges, or bring your own fit.",
};

export default function StyleBoardPage() {
  return (
    <OnPointLayout>
      <Suspense>
        <StyleBoard />
      </Suspense>
    </OnPointLayout>
  );
}
