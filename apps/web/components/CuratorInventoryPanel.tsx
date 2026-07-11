"use client";

import { useState } from "react";
import { Plus, ChevronDown, ChevronUp } from "lucide-react";
import { InventoryForm } from "./InventoryForm";
import { useCuratorOwner } from "../lib/hooks/use-curator-owner";

interface CuratorInventoryPanelProps {
  curatorSlug: string;
  /** Parent already verified owner (e.g. CuratorOwnerTools). */
  skipOwnerCheck?: boolean;
}

/**
 * A collapsible panel that lets a curator add inventory from their
 * own storefront. Shows a floating "Add item" button that expands
 * to reveal the InventoryForm.
 *
 * Detection of "is this my storefront" is intentionally simple:
 * we check localStorage for the last created slug (set during
 * onboarding). In a future iteration this should use a proper
 * auth session.
 */
export function CuratorInventoryPanel({
  curatorSlug,
  skipOwnerCheck = false,
}: CuratorInventoryPanelProps) {
  const isOwner = useCuratorOwner(curatorSlug);
  const [open, setOpen] = useState(false);

  if (!skipOwnerCheck && !isOwner) return null;

  return (
    <div className="mb-6">
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 active:scale-[0.98]"
      >
        <Plus className="h-4 w-4" />
        {open ? "Close" : "Add item"}
        {open ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {/* Form panel */}
      {open && (
        <div className="mt-4">
          <InventoryForm
            curatorSlug={curatorSlug}
            onCreated={() => {
              // Reload the page after a brief delay to show the new listing
              setTimeout(() => window.location.reload(), 1500);
            }}
          />
        </div>
      )}
    </div>
  );
}
