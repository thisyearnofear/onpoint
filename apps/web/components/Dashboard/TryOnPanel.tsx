"use client";

import React from "react";
import { motion } from "framer-motion";
import { Camera } from "lucide-react";
import { VirtualTryOn } from "../VirtualTryOn";

interface TryOnPanelProps {
  deepLinkFrom?: string;
  deepLinkItem?: string;
  onDismissDeepLink: () => void;
}

export function TryOnPanel({ deepLinkFrom, deepLinkItem, onDismissDeepLink }: TryOnPanelProps) {
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
            {deepLinkItem && (
              <> — item <span className="font-mono">{deepLinkItem}</span></>
            )}
          </p>
          <button
            onClick={onDismissDeepLink}
            className="ml-auto text-[10px] text-accent/60 hover:text-accent"
          >
            Dismiss
          </button>
        </div>
      )}
      <VirtualTryOn />
    </motion.div>
  );
}
