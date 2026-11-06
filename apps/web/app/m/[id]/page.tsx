import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getApiBase } from "@/lib/utils/api-base";
import { ShareAttributionCapture } from "@/components/ShareAttributionCapture";
import { ArtifactShell } from "@/components/surface/ArtifactShell";
import { ExitLinks } from "@/components/surface/ExitLinks";
import type { SurfaceItem } from "@/components/surface/ItemRow";
import { Flipbook } from "./Flipbook";

export const metadata: Metadata = { title: "Your issue | OnPoint" };

export interface MagazineData {
  id: string;
  photoUrl: string | null;
  recipientName: string | null;
  senderName: string | null;
  note: string | null;
  items: SurfaceItem[];
  issue: number;
  replyTo: string | null;
  heroListingId: string | null;
}

async function load(id: string): Promise<MagazineData | null> {
  try {
    const res = await fetch(`${getApiBase()}/api/magazine/${encodeURIComponent(id)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function MagazineViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mag = await load(id);
  if (!mag) notFound();
  return (
    <ArtifactShell exits={<ExitLinks kinds={["board"]} />}>
      <ShareAttributionCapture />
      <Flipbook mag={mag} />
    </ArtifactShell>
  );
}
