"use client";

import { motion } from "framer-motion";
import { BookHeart, Bookmark, Flag, Globe, Sparkles } from "lucide-react";
import { Button } from "@repo/ui/button";
import type { PanelView } from "./types";

export function CommunityEmpty({
  onTryOn,
  view,
  onBackToBrowse,
}: {
  onTryOn: () => void;
  view: PanelView;
  onBackToBrowse?: () => void;
}) {
  if (view === "reactions") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center min-h-[40vh] px-6 text-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500/20 to-pink-500/20 border border-rose-500/20 flex items-center justify-center mb-4">
          <BookHeart className="w-7 h-7 text-rose-400" />
        </div>
        <h3 className="text-lg font-bold text-foreground mb-2">
          No reactions yet
        </h3>
        <p className="text-sm text-muted-foreground max-w-xs mb-6">
          When you like a look or react with an emoji, it will show up here.
          Start exploring the community feed!
        </p>
        <Button
          onClick={onBackToBrowse}
          variant="outline"
          className="rounded-full px-6 py-3"
        >
          <Globe className="w-4 h-4 mr-2" />
          Browse Trending
        </Button>
      </motion.div>
    );
  }

  if (view === "saved") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center min-h-[40vh] px-6 text-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500/20 to-blue-500/20 border border-sky-500/20 flex items-center justify-center mb-4">
          <Bookmark className="w-7 h-7 text-sky-400" />
        </div>
        <h3 className="text-lg font-bold text-foreground mb-2">
          No saved looks yet
        </h3>
        <p className="text-sm text-muted-foreground max-w-xs mb-6">
          Click the bookmark icon on any community look to save it here for
          quick access later.
        </p>
        <Button
          onClick={onBackToBrowse}
          variant="outline"
          className="rounded-full px-6 py-3"
        >
          <Globe className="w-4 h-4 mr-2" />
          Browse Trending
        </Button>
      </motion.div>
    );
  }

  if (view === "moderation") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center min-h-[40vh] px-6 text-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500/20 to-orange-500/20 border border-rose-500/20 flex items-center justify-center mb-4">
          <Flag className="w-7 h-7 text-rose-400" />
        </div>
        <h3 className="text-lg font-bold text-foreground mb-2">
          No reported looks
        </h3>
        <p className="text-sm text-muted-foreground max-w-xs mb-6">
          When you flag a community look, it will appear here for review.
          Reported looks are stored locally and not shared.
        </p>
        <Button
          onClick={onBackToBrowse}
          variant="outline"
          className="rounded-full px-6 py-3"
        >
          <Globe className="w-4 h-4 mr-2" />
          Browse Trending
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center min-h-[40vh] px-6 text-center"
    >
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/20 flex items-center justify-center mb-4">
        <Globe className="w-7 h-7 text-primary" />
      </div>
      <h3 className="text-lg font-bold text-foreground mb-2">
        No community looks yet
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-6">
        Be the first! After your next style analysis, opt in to share it
        anonymously with the community.
      </p>
      <Button
        onClick={onTryOn}
        className="bg-gradient-to-r from-primary to-accent text-white font-bold rounded-full px-6 py-3"
      >
        <Sparkles className="w-4 h-4 mr-2" />
        Start Styling
      </Button>
    </motion.div>
  );
}
