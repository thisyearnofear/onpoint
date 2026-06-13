"use client";

import React from "react";
import { Button } from "@repo/ui/button";
import {
  ArrowLeft,
  ShieldCheck,
  AlertCircle,
  Camera,
  Ruler,
  Palette,
  Zap,
  Upload,
} from "lucide-react";
import { motion } from "framer-motion";
import { ProviderComparisonModal } from "./ProviderComparisonModal";
import { useStartButton } from "./hooks/useStartButton";

interface LiveSessionStartScreenProps {
  onBack: () => void;
  isPremium: boolean;
  isInitializing: boolean;
  error: string | null;
  onDismissError: () => void;
  onStart: () => void;
  onCompareProviders: () => void;
  showComparison: boolean;
  onCloseComparison: () => void;
  onSelectComparisonProvider: (provider: string, goal: string) => void;
  capturesRemaining: number;
  /**
   * Optional handler to switch to photo upload mode from the start screen.
   */
  onUseUploadPhoto?: () => void;
}

export function LiveSessionStartScreen({
  onBack,
  isPremium,
  isInitializing,
  error,
  onDismissError,
  onStart,
  onCompareProviders,
  showComparison,
  onCloseComparison,
  onSelectComparisonProvider,
  capturesRemaining,
  onUseUploadPhoto,
}: LiveSessionStartScreenProps) {
  // Local state — flips on click so the button shows feedback immediately,
  // before the parent swaps to the camera view and isInitializing kicks in.
  const { showSpinner, handleStart } = useStartButton(onStart, isInitializing);

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border/50 shrink-0">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
            {isPremium ? "Premium" : "Free · No signup"}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col items-center gap-5 sm:gap-6 max-w-2xl mx-auto w-full px-5 sm:px-6 py-6 sm:py-8">
          <div className="w-full">
            <div className="relative aspect-[4/5] sm:aspect-[16/10] w-full overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/30 shadow-2xl shadow-emerald-500/10">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,_rgba(16,185,129,0.18),_transparent_60%)]" />

              <div className="absolute inset-0 flex items-end justify-center">
                <div className="relative w-[44%] h-[78%]">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[34%] aspect-square rounded-full bg-gradient-to-b from-slate-300/70 to-slate-500/70" />
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-[58%] rounded-t-[45%] bg-gradient-to-b from-slate-400/60 to-slate-600/60" />
                </div>
              </div>

              <div className="absolute inset-6 sm:inset-10">
                <div className="relative w-full h-full">
                  <div className="absolute -top-1 -left-1 w-8 h-8 border-t-2 border-l-2 border-emerald-300/80 rounded-tl-2xl" />
                  <div className="absolute -top-1 -right-1 w-8 h-8 border-t-2 border-r-2 border-emerald-300/80 rounded-tr-2xl" />
                  <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-2 border-l-2 border-emerald-300/80 rounded-bl-2xl" />
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-2 border-r-2 border-emerald-300/80 rounded-br-2xl" />
                </div>
              </div>

              <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-400/30 shadow-lg">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">
                  Good Position
                </span>
              </div>

              <div className="absolute bottom-4 inset-x-3 sm:inset-x-6 flex gap-1.5 sm:gap-2">
                {[
                  { label: "Framing", value: "locked", color: "text-emerald-300" },
                  { label: "Fit", value: "reading", color: "text-sky-300" },
                  { label: "Palette", value: "sampling", color: "text-violet-300" },
                  { label: "Shop", value: "matches", color: "text-amber-300" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="flex-1 rounded-lg bg-black/40 backdrop-blur-md border border-white/10 px-1.5 sm:px-2 py-1.5 min-w-0"
                  >
                    <p className="text-[8px] uppercase tracking-wider text-white/50 font-bold truncate">
                      {s.label}
                    </p>
                    <p className={`text-[10px] sm:text-[11px] font-bold truncate ${s.color}`}>
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>

              {isPremium && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  <motion.div
                    aria-hidden
                    className="absolute inset-x-0 h-full"
                    initial={{ y: "-100%" }}
                    animate={{ y: ["-100%", "100%", "-100%"] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <div className="h-px bg-gradient-to-r from-transparent via-emerald-300/80 to-transparent shadow-[0_0_20px_rgba(16,185,129,0.6)]" />
                  </motion.div>
                </div>
              )}
            </div>
          </div>

          <div className="text-center space-y-2 max-w-lg">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                {isPremium ? "Live · Premium" : "On-device preview · No signup"}
              </span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black text-foreground tracking-tighter italic">
              {isPremium ? "Live Style Camera" : "Snap & Analyze"}
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto leading-relaxed">
              {isPremium
                ? "Real-time AI feedback as you move. Get fit, palette, and voice-led styling."
                : "Tap to capture. Get fit, palette, and shopping matches in seconds."}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 w-full max-w-md">
            {[
              { icon: Ruler, label: "Fit", desc: "Proportion read" },
              { icon: Palette, label: "Palette", desc: "Color harmony" },
              { icon: Zap, label: "Matches", desc: "Shop the gaps" },
            ].map(({ icon: Icon, label, desc }) => (
              <div
                key={label}
                className="flex flex-col items-center text-center p-2.5 sm:p-3 rounded-xl border border-border bg-card/50"
              >
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-1.5">
                  <Icon className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-xs font-bold">{label}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{desc}</p>
              </div>
            ))}
          </div>

          {/* Capture limit badge — free tier only */}
          {!isPremium && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/25">
              <Camera className="w-3 h-3 text-indigo-400" />
              <span className="text-[10px] font-mono font-bold text-indigo-300">
                {capturesRemaining} free capture{capturesRemaining !== 1 ? "s" : ""} remaining
              </span>
            </div>
          )}

          {error && (
            <div className="w-full max-w-md rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-left">
              <div className="flex items-center gap-2 text-rose-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p className="text-xs font-bold uppercase tracking-wider">Session Error</p>
              </div>
              <p className="mt-2 text-sm text-rose-300">{error}</p>
              {error.toLowerCase().includes("camera") && (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-rose-300/70">
                    Make sure you allow camera access and are on HTTPS.
                  </p>
                  <button
                    onClick={onDismissError}
                    className="text-xs text-amber-300 hover:text-amber-200 underline underline-offset-2"
                  >
                    Use Upload Photo instead →
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="w-full max-w-md space-y-2">
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-full py-6 text-base sm:text-lg font-bold shadow-xl shadow-emerald-500/30 transition-all hover:shadow-emerald-500/50"
              loading={showSpinner}
              loadingIcon={
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              }
              onClick={handleStart}
            >
              <Camera className="w-5 h-5" />
              {showSpinner ? "Connecting..." : "START STYLE CAMERA"}
            </Button>
            <p className="text-[10px] text-center text-muted-foreground/70 leading-relaxed">
              We only open the camera after you tap. Frames stay on your device unless you save them.
            </p>
          </div>

          <button
            onClick={onCompareProviders}
            className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            Compare AI providers →
          </button>

          {onUseUploadPhoto && (
            <button
              onClick={onUseUploadPhoto}
              className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors inline-flex items-center gap-1.5"
            >
              <Upload className="w-3 h-3" />
              Or upload a photo instead →
            </button>
          )}

          <ProviderComparisonModal
            isOpen={showComparison}
            onClose={onCloseComparison}
            onSelect={(p, g) => onSelectComparisonProvider(p as string, g)}
          />
        </div>
      </div>
    </div>
  );
}
