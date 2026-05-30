"use client";

import React from "react";
import { motion } from "framer-motion";
import { Camera } from "lucide-react";
import { VirtualTryOn } from "../VirtualTryOn";
import type { TryOnSelection } from "../../lib/utils/try-on-selection";
import {
  consumePendingTryOnSelection,
  resolveStorefrontTryOnSelection,
  resolveTryOnSelection,
} from "../../lib/utils/try-on-selection";

interface TryOnPanelProps {
  deepLinkFrom?: string;
  deepLinkItem?: string;
  onDismissDeepLink: () => void;
}

export function TryOnPanel({ deepLinkFrom, deepLinkItem, onDismissDeepLink }: TryOnPanelProps) {
  const [selection, setSelection] = React.useState<TryOnSelection | null>(null);
  const [selectionLoading, setSelectionLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    async function resolveSelection() {
      setSelectionLoading(Boolean(deepLinkFrom && deepLinkItem));

      const pending = consumePendingTryOnSelection();
      const local = resolveTryOnSelection(deepLinkItem);

      if (!deepLinkFrom || !deepLinkItem) {
        if (!cancelled) {
          setSelection(local || pending);
          setSelectionLoading(false);
        }
        return;
      }

      try {
        const storefrontSelection = await resolveStorefrontTryOnSelection(
          deepLinkFrom,
          deepLinkItem,
        );
        if (!cancelled) {
          setSelection(storefrontSelection || local || pending);
        }
      } catch {
        if (!cancelled) {
          setSelection(local || pending);
        }
      } finally {
        if (!cancelled) setSelectionLoading(false);
      }
    }

    resolveSelection();
    return () => {
      cancelled = true;
    };
  }, [deepLinkFrom, deepLinkItem]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      {deepLinkFrom && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3">
          <Camera className="w-4 h-4 text-accent shrink-0" />
          <p className="text-xs text-accent">
            Styling from{" "}
            <span className="font-bold">{deepLinkFrom}</span>
            's storefront
            {selection?.name ? (
              <> — {selection.name}</>
            ) : deepLinkItem ? (
              <> — item <span className="font-mono">{deepLinkItem}</span></>
            ) : null}
            {selectionLoading && <> — resolving item...</>}
          </p>
          <button
            onClick={onDismissDeepLink}
            className="ml-auto text-[10px] text-accent/60 hover:text-accent"
          >
            Dismiss
          </button>
        </div>
      )}
      <VirtualTryOn selectedTryOnItem={selection} />
    </motion.div>
  );
}
