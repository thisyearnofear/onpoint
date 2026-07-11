"use client";

import { useCuratorOwner } from "../../lib/hooks/use-curator-owner";
import { CuratorHomePanel } from "./CuratorHomePanel";
import { CuratorInventoryPanel } from "../CuratorInventoryPanel";

interface CuratorOwnerToolsProps {
  curatorSlug: string;
  curatorName: string;
}

/**
 * Owner-only chrome on a curator storefront: home stats + add-inventory panel.
 * Single owner check — avoids duplicate localStorage reads.
 */
export function CuratorOwnerTools({ curatorSlug, curatorName }: CuratorOwnerToolsProps) {
  const isOwner = useCuratorOwner(curatorSlug);

  if (!isOwner) return null;

  const storefrontUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/s/${curatorSlug}`
      : `/s/${curatorSlug}`;

  return (
    <div className="mb-8 space-y-6">
      <CuratorHomePanel
        curatorSlug={curatorSlug}
        curatorName={curatorName}
        storefrontUrl={storefrontUrl}
      />
      <CuratorInventoryPanel curatorSlug={curatorSlug} skipOwnerCheck />
    </div>
  );
}
