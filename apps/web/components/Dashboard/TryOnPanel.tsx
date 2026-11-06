"use client";

import React from "react";
import { motion } from "framer-motion";
import { Camera } from "lucide-react";
import { VirtualTryOn } from "../VirtualTryOn";
import type { StylistPersona } from "@repo/ai-client";
import type { TryOnSelection } from "../../lib/utils/try-on-selection";
import {
  consumePendingTryOnSelection,
  resolveStorefrontTryOnSelection,
  resolveTryOnSelection,
} from "../../lib/utils/try-on-selection";
import { describeDeepLinkSource, resolveDeepLinkSource } from "../../lib/utils/deep-link-source";

interface TryOnPanelProps {
  deepLinkFrom?: string;
  deepLinkItem?: string;
  deepLinkPersona?: string;
  onDismissDeepLink: () => void;
}

export function TryOnPanel({ deepLinkFrom, deepLinkItem, deepLinkPersona, onDismissDeepLink }: TryOnPanelProps) {
  const source = React.useMemo(
    () => resolveDeepLinkSource(deepLinkFrom),
    [deepLinkFrom],
  );
  const caption = describeDeepLinkSource(source);
  const curatorSlug = source?.kind === "storefront" ? source.curatorSlug : undefined;

  const [selection, setSelection] = React.useState<TryOnSelection | null>(null);
  const [selectionLoading, setSelectionLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    async function resolveSelection() {
      setSelectionLoading(Boolean(curatorSlug && deepLinkItem));

      const pending = consumePendingTryOnSelection();
      const local = resolveTryOnSelection(deepLinkItem);

      if (!curatorSlug || !deepLinkItem) {
        if (!cancelled) {
          setSelection(local || pending);
          setSelectionLoading(false);
        }
        return;
      }

      try {
        const storefrontSelection = await resolveStorefrontTryOnSelection(
          curatorSlug,
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
  }, [curatorSlug, deepLinkItem]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      {caption && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3">
          <Camera className="w-4 h-4 text-accent shrink-0" />
          <p className="text-xs text-accent">
            {caption}
            {selection?.name ? (
              <> — {selection.name}</>
            ) : deepLinkItem ? (
              <> — item <span className="font-mono">{deepLinkItem}</span></>
            ) : null}
            {selectionLoading && <> — resolving item...</>}
          </p>
          <button
            onClick={onDismissDeepLink}
            className="ml-auto text-xs text-accent/60 hover:text-accent"
          >
            Dismiss
          </button>
        </div>
      )}
      <VirtualTryOn
        selectedTryOnItem={selection}
        initialPersona={deepLinkPersona as StylistPersona | undefined}
        initialCuratorSlug={curatorSlug}
      />
    </motion.div>
  );
}
