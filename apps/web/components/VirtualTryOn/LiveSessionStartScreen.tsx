"use client";

import React from "react";
import { Button } from "@repo/ui/button";
import {
  ArrowLeft,
  AlertCircle,
  Camera,
  Ruler,
  Palette,
  Zap,
  Upload,
} from "lucide-react";
import { ProviderComparisonModal } from "./ProviderComparisonModal";
import { useStartButton } from "./hooks/useStartButton";
import { Spinner } from "../state";

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
  /** Whether a completed session exists in the history store. */
  hasStoredSession?: boolean;
  /** Opens the last completed session summary from history. */
  onViewStoredSession?: () => void;
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
  hasStoredSession,
  onViewStoredSession,
}: LiveSessionStartScreenProps) {
  // Local state — flips on click so the button shows feedback immediately,
  // before the parent swaps to the camera view and isInitializing kicks in.
  const { showSpinner, handleStart } = useStartButton(onStart, isInitializing);

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between border-b border-border/50 px-4 py-3 sm:px-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
        <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {isPremium ? "Premium" : "Free · no signup"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-7 px-5 py-10 sm:py-14">
          <div className="max-w-lg space-y-3 text-center">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-primary">
              {isPremium ? "The live mirror" : "The fitting room"}
            </p>
            <h1 className="font-display text-4xl leading-[1.05] tracking-[-0.02em] text-foreground sm:text-5xl">
              {isPremium ? "Style, as you move." : "Step in front of the mirror."}
            </h1>
            <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
              {isPremium
                ? "Real-time feedback as you move — fit, palette, and a voice that knows your wardrobe."
                : "Hold still, tap once. Fit, palette, and the pieces that fill the gaps — in seconds."}
            </p>
            {!isPremium && (
              <p className="mx-auto max-w-md text-xs leading-relaxed text-muted-foreground/80">
                A style preview, not the exact garment — the $0.03 try-on renders the real piece on you.
              </p>
            )}
          </div>

          <div className="grid w-full max-w-md grid-cols-3 gap-3">
            {[
              { icon: Ruler, label: "Fit", desc: "Proportion read" },
              { icon: Palette, label: "Palette", desc: "Color harmony" },
              { icon: Zap, label: "Matches", desc: "Shop the gaps" },
            ].map(({ icon: Icon, label, desc }) => (
              <div
                key={label}
                className="flex flex-col items-center border border-border bg-card p-4 text-center"
              >
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <p className="text-xs font-bold text-foreground">{label}</p>
                <p className="mt-0.5 text-xs leading-tight text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>

          {!isPremium && (
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5">
              <Camera className="h-3 w-3 text-muted-foreground" />
              <span className="font-mono text-xs font-bold text-muted-foreground">
                {capturesRemaining} free capture{capturesRemaining !== 1 ? "s" : ""} — plenty for a first look
              </span>
            </div>
          )}

          {error && (
            <div className="w-full max-w-md border border-error/30 bg-error/10 p-4 text-left">
              <div className="flex items-center gap-2 text-error">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p className="text-xs font-bold uppercase tracking-wider">Something&rsquo;s off</p>
              </div>
              <p className="mt-2 text-sm text-error/90">{error}</p>
              {error.toLowerCase().includes("camera") && (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-error/70">
                    Check camera access is allowed and you&rsquo;re on HTTPS.
                  </p>
                  <button
                    onClick={onDismissError}
                    className="text-xs font-bold text-foreground underline underline-offset-2"
                  >
                    Upload a photo instead →
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="w-full max-w-md space-y-2">
            <Button
              className="w-full rounded-full bg-primary py-6 text-base font-bold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-primary/40"
              loading={showSpinner}
              loadingIcon={<Spinner size="sm" tone="inverse" />}
              onClick={handleStart}
            >
              <Camera className="h-5 w-5" />
              {showSpinner ? "Opening…" : "Open the mirror"}
            </Button>
            <p className="text-center text-xs leading-relaxed text-muted-foreground">
              The camera only opens when you ask — frames stay on your device unless you save them.
            </p>
          </div>

          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onCompareProviders}
              className="text-xs text-muted-foreground/70 transition-colors hover:text-muted-foreground"
            >
              Compare AI providers →
            </button>
            {onUseUploadPhoto && (
              <button
                onClick={onUseUploadPhoto}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/70 transition-colors hover:text-muted-foreground"
              >
                <Upload className="h-3 w-3" />
                Or upload a photo instead →
              </button>
            )}
            {hasStoredSession && onViewStoredSession && (
              <button
                onClick={onViewStoredSession}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-primary transition-colors hover:text-primary/80"
              >
                View last analysis →
              </button>
            )}
          </div>

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
