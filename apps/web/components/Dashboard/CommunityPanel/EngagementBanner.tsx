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
      className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 flex items-center justify-between"
    >
      <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
        <Bell className="w-3.5 h-3.5" />
        <span>
          Your submitted looks received new likes or reactions!
        </span>
      </div>
      <button
        onClick={onDismiss}
        className="rounded-full p-1 text-emerald-600/50 hover:text-emerald-600 transition-colors"
      >
        <ChevronRight className="w-3.5 h-3.5 rotate-90" />
      </button>
    </motion.div>
  );
}
