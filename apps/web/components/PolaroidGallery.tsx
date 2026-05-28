"use client";

import React, { useState, useRef } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useSpring,
} from "framer-motion";
import {
  Camera,
  Trash2,
  Sparkles,
  ImageOff,
  Wand2,
  ChevronDown,
} from "lucide-react";
import { Button } from "@repo/ui/button";
import {
  useAnalysisHistory,
  type AnalysisSession,
} from "../lib/stores/analysis-history-store";
import { StyleReportCard } from "./VirtualTryOn/StyleReportCard";
import type { StylistPersona } from "@repo/ai-client";
import type { SessionFeedback } from "./VirtualTryOn/hooks/useLiveSession";

// ── Image compression helper ──

/**
 * Compress a base64 data-URL to a thumbnail for storage efficiency.
 * Targets ~200px wide JPEG at quality 0.55 -- typically 10-20KB vs 200KB+ originals.
 */
export async function compressToThumbnail(
  dataUrl: string,
  maxWidth = 200,
  quality = 0.55,
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// ── Deterministic rotation per card (stable across renders) ──

function cardRotation(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return ((hash % 7) - 3); // -3deg to +3deg
}

// ── Scroll-aware Polaroid Card ──

function PolaroidCard({
  session,
  onOpen,
  onDelete,
}: {
  session: AnalysisSession;
  onOpen: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const baseRotation = cardRotation(session.id);

  // Track this card's position relative to the viewport
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "start center"],
  });

  // Map scroll progress to rotation: starts at baseRotation*2.5, straightens at center
  const rawRotation = useTransform(
    scrollYProgress,
    [0, 1],
    [baseRotation * 2.5, 0],
  );
  const rotation = useSpring(rawRotation, { stiffness: 120, damping: 20 });

  // Fade and slide in as card enters viewport
  const opacity = useTransform(scrollYProgress, [0, 0.4], [0, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [40, 0]);

  const date = new Date(session.createdAt);
  const dateLabel = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <motion.div
      ref={ref}
      style={{ opacity, y, rotate: rotation }}
      whileHover={{ rotate: 0, scale: 1.04, zIndex: 10 }}
      whileTap={{ scale: 0.97 }}
      onClick={onOpen}
      className="relative cursor-pointer group"
    >
      {/* Polaroid frame */}
      <div className="bg-white dark:bg-zinc-100 rounded-md shadow-lg shadow-black/15 p-2 pb-10">
        {/* Photo */}
        <div className="relative aspect-[3/4] rounded-sm overflow-hidden bg-zinc-200">
          {session.coverImage ? (
            <img
              src={session.coverImage}
              alt={`Style analysis from ${dateLabel}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-400">
              <ImageOff className="w-8 h-8" />
            </div>
          )}

          {/* Score badge */}
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-sm text-white text-xs font-bold flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            {session.score}/10
          </div>

          {/* Delete button */}
          <button
            onClick={onDelete}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white/70 hover:text-white hover:bg-rose-600 transition-colors opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>

        {/* Caption area (polaroid bottom) */}
        <div className="absolute bottom-0 left-0 right-0 px-3 pb-2.5 pt-1">
          <p className="text-zinc-800 text-[11px] font-medium leading-tight line-clamp-2">
            {session.headline || "Style analysis"}
          </p>
          <div className="flex items-center justify-between mt-1">
            <span className="text-zinc-400 text-[10px]">{dateLabel}</span>
            {session.sessionGoal && (
              <span className="text-zinc-500 text-[9px] capitalize bg-zinc-100 px-1.5 py-0.5 rounded-full">
                {session.sessionGoal}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Parallax Hero Background ──

function ParallaxHero({ sessions }: { sessions: AnalysisSession[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  // Parallax: background shifts up slower than scroll
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const bgScale = useTransform(scrollYProgress, [0, 1], [1, 1.15]);

  // Pick up to 6 cover images for the mosaic
  const covers = sessions
    .filter((s) => s.coverImage)
    .slice(0, 6)
    .map((s) => s.coverImage!);

  if (covers.length === 0) return null;

  return (
    <div ref={ref} className="relative h-48 sm:h-64 overflow-hidden rounded-2xl mb-8">
      {/* Blurred photo mosaic */}
      <motion.div
        style={{ y: bgY, scale: bgScale }}
        className="absolute inset-0 grid grid-cols-3 gap-0.5 opacity-40 blur-[2px]"
      >
        {covers.map((src, i) => (
          <div key={i} className="relative overflow-hidden">
            <img
              src={src}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        ))}
        {Array.from({ length: Math.max(0, 6 - covers.length) }).map((_, i) => (
          <div key={`empty-${i}`} className="bg-muted" />
        ))}
      </motion.div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/40 to-background" />

      {/* Hero content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
            My Looks
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {sessions.length} style analysis{sessions.length !== 1 ? "es" : ""}
            {" "}&middot; Scroll to explore
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: 0.6 }}
          className="mt-3"
        >
          <ChevronDown className="w-5 h-5 animate-bounce text-muted-foreground" />
        </motion.div>
      </div>
    </div>
  );
}

// ── Detail Modal (re-uses StyleReportCard) ──

function PolaroidDetail({
  session,
  onClose,
}: {
  session: AnalysisSession;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <StyleReportCard
          score={session.score}
          persona={(session.persona as StylistPersona) || "luxury"}
          takeaways={session.takeaways}
          topics={session.topics}
          fullFeedback={[] as SessionFeedback[]}
          captureImage={session.coverImage || undefined}
          sessionGoal={session.sessionGoal || undefined}
          onClose={onClose}
        />
      </motion.div>
    </motion.div>
  );
}

// ── Empty State ──

function EmptyState({
  onTryOn,
  onCreateDesign,
}: {
  onTryOn: () => void;
  onCreateDesign: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-24 h-24 rounded-3xl bg-muted/50 border border-border flex items-center justify-center mb-6"
      >
        <Camera className="w-10 h-10 text-muted-foreground" />
      </motion.div>
      <h3 className="text-lg font-bold text-foreground mb-2">No looks yet</h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-6">
        Your style analyses will appear here as a visual collection after your
        first try-on session.
      </p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Button
          onClick={onTryOn}
          className="bg-primary hover:bg-primary/90 text-white font-bold rounded-full px-6 py-3"
        >
          <Camera className="w-4 h-4 mr-2" />
          Start Your First Look
        </Button>
        <Button
          onClick={onCreateDesign}
          variant="outline"
          className="rounded-full px-6 py-3"
        >
          <Wand2 className="w-4 h-4 mr-2" />
          Create a Design
        </Button>
      </div>
    </div>
  );
}

// ── Main Gallery ──

interface PolaroidGalleryProps {
  onNavigateToTryOn: () => void;
  onNavigateToDesign?: () => void;
}

export function PolaroidGallery({
  onNavigateToTryOn,
  onNavigateToDesign,
}: PolaroidGalleryProps) {
  const { sessions, removeSession, sessionCount } = useAnalysisHistory();
  const [selectedSession, setSelectedSession] =
    useState<AnalysisSession | null>(null);

  if (sessionCount() === 0) {
    return (
      <EmptyState
        onTryOn={onNavigateToTryOn}
        onCreateDesign={onNavigateToDesign || onNavigateToTryOn}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Action row */}
      <div className="flex items-center justify-end gap-2">
        {onNavigateToDesign && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onNavigateToDesign}
            className="text-muted-foreground gap-1.5"
          >
            <Wand2 className="w-4 h-4" />
            <span className="hidden sm:inline">Design</span>
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onNavigateToTryOn}
          className="text-primary gap-1.5"
        >
          <Camera className="w-4 h-4" />
          New Look
        </Button>
      </div>

      {/* Parallax hero background with photo mosaic */}
      <ParallaxHero sessions={sessions} />

      {/* Polaroid grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-5">
        {sessions.map((session) => (
          <PolaroidCard
            key={session.id}
            session={session}
            onOpen={() => setSelectedSession(session)}
            onDelete={(e) => {
              e.stopPropagation();
              removeSession(session.id);
            }}
          />
        ))}
      </div>

      {/* Detail modal */}
      <AnimatePresence>
        {selectedSession && (
          <PolaroidDetail
            session={selectedSession}
            onClose={() => setSelectedSession(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
