"use client";

import { useCuratorOwner } from "../../lib/hooks/use-curator-owner";
import { CuratorHomePanel } from "./CuratorHomePanel";
import { CuratorInventoryPanel } from "../CuratorInventoryPanel";
import { CuratorLookCreator } from "./CuratorLookCreator";
import { CuratorLinkAgent } from "./CuratorLinkAgent";

interface StorefrontListing {
  id: string;
  title: string | null;
  inventoryType: string;
  sizes: Array<{ size: string; stock: number; price: number }>;
  kit?: { club: string; kitType: string; season?: string; crestUrl?: string | null } | null;
}

interface CuratorOwnerToolsProps {
  curatorSlug: string;
  curatorName: string;
  whatsapp?: string;
  listings?: StorefrontListing[];
  linkedAgentAddress?: string | null;
  /** When provided, opens the look creator in edit mode for this look */
  editLookSlug?: string;
}

/**
 * Owner-only chrome on a curator storefront: home stats + add-inventory panel
 * + look creator. Single owner check — avoids duplicate localStorage reads.
 */
export function CuratorOwnerTools({
  curatorSlug,
  curatorName,
  whatsapp,
  listings = [],
  linkedAgentAddress = null,
  editLookSlug,
}: CuratorOwnerToolsProps) {
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
        whatsapp={whatsapp}
      />
      <CuratorInventoryPanel curatorSlug={curatorSlug} skipOwnerCheck />
      {whatsapp && (
        <CuratorLinkAgent
          curatorSlug={curatorSlug}
          whatsapp={whatsapp}
          currentLinkedAddress={linkedAgentAddress}
        />
      )}
      {whatsapp && listings.length > 0 && (
        <CuratorLookCreator
          curatorSlug={curatorSlug}
          curatorName={curatorName}
          whatsapp={whatsapp}
          listings={listings}
          editSlug={editLookSlug}
        />
      )}
    </div>
  );
}
