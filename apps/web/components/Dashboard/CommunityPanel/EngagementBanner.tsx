"use client";

import { motion } from "framer-motion";
import { Bell, ChevronRight } from "lucide-react";

export function EngagementBanner({
  hasEngagement,
  onDismiss,
}: {
  hasEngagement: boolean;
  onDismiss: () => void;
}) {
  if (!hasEngagement) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="rounded-xl border border-success/20 bg-success/10 px-4 py-3 flex items-center justify-between"
    >
      <div className="flex items-center gap-2 text-xs text-success dark:text-emerald-300">
        <Bell className="w-3.5 h-3.5" />
        <span>
          Your submitted looks received new likes or reactions!
        </span>
      </div>
      <button
        onClick={onDismiss}
        className="rounded-full p-1 text-success/50 hover:text-success transition-colors"
      >
        <ChevronRight className="w-3.5 h-3.5 rotate-90" />
      </button>
    </motion.div>
  );
}
