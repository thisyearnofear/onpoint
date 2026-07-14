"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Camera, X, Play } from "lucide-react";

export function DemoToggleButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-medium text-muted-foreground transition-all hover:border-primary/30 hover:text-foreground hover:bg-muted/50 active:bg-muted active:scale-[0.98]"
    >
      <Play className="h-4 w-4" />
      See how it works
    </button>
  );
}

export function DemoWalkthrough({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const steps = [
    {
      title: "Upload your photo",
      description: "Snap a photo or upload one from your gallery. OnPoint analyzes your outfit in seconds.",
      image: "/assets/1Model.png",
      badge: "1. Upload",
      stat: null,
    },
    {
      title: "AI analyzes your style",
      description: "Our AI stylists read your silhouette, color palette, and fit. Get a detailed score and personalized feedback.",
      image: "/assets/2Model.png",
      badge: "2. AI Analysis",
      stat: { label: "Score", value: "8/10" },
    },
    {
      title: "Save & share your look",
      description: "Save to My Looks, share a polaroid-style card to Farcaster or Twitter, or email yourself the full report.",
      image: "/assets/3Model.png",
      badge: "3. Share",
      stat: { label: "Shared", value: "1.2K" },
    },
  ];

  const advance = useCallback(() => {
    setStep((prev) => {
      if (prev >= steps.length - 1) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        return prev;
      }
      return prev + 1;
    });
  }, [steps.length]);

  useEffect(() => {
    intervalRef.current = setInterval(advance, 4000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [advance]);

  const current = steps[step]!;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="How it works"
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full bg-black/20 p-1.5 text-white/70 hover:text-white active:bg-black/30 active:scale-[0.95] transition-[background-color,transform,color]"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Image area */}
        <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20">
          <Image
            src={current.image}
            alt={current.title}
            fill
            className="object-cover opacity-80 transition-all duration-700"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

          {/* Step badge */}
          <div className="absolute bottom-4 left-4 rounded-full bg-primary/90 px-3 py-1 text-xs font-bold text-white shadow-lg">
            {current.badge}
          </div>

          {/* Stat badge */}
          {current.stat && (
            <div className="absolute bottom-4 right-4 rounded-xl bg-black/70 px-3 py-2 text-center backdrop-blur-sm">
              <p className="text-[11px] uppercase tracking-wider text-white/60">{current.stat.label}</p>
              <p className="text-lg font-black text-white">{current.stat.value}</p>
            </div>
          )}

          {/* Step dots */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  setStep(i);
                }}
                className={`h-1.5 rounded-full transition-all duration-300 active:scale-y-[1.5] ${
                  i === step ? "w-6 bg-white" : "w-1.5 bg-white/40"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div>
            <h3 className="text-lg font-bold text-foreground">{current.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              {current.description}
            </p>
          </div>

          {/* Progress bar */}
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-1000 ease-linear"
              style={{ width: `${((step + 1) / steps.length) * 100}%` }}
            />
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Step {step + 1} of {steps.length}
            </div>
            <div className="flex gap-2">
              {step < steps.length - 1 ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    advance();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary/90 active:bg-primary/80 active:scale-[0.98] transition-[background-color,transform]"
                >
                  Next
                  <ArrowRight className="h-3 w-3" />
                </button>
              ) : (
                <Link
                  href="/lab"
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-xs font-bold text-white hover:bg-primary/90 active:bg-primary/80 active:scale-[0.98] transition-[background-color,transform]"
                >
                  <Camera className="h-3.5 w-3.5" />
                  Try it free
                  <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
