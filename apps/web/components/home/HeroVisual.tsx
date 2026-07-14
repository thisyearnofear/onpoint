"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import type { StylistPersona } from "@repo/ai-client";
import { PersonaChip } from "./PersonaChip";

export function HeroVisual() {
  const [step, setStep] = useState(0);
  const cyclingPersonas: StylistPersona[] = ["miranda", "edina", "shaft", "luxury", "streetwear"];

  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % 5), 5000);
    return () => clearInterval(id);
  }, []);

  const steps = [
    {
      mainImage: "/assets/1Model.png",
      mainLabel: "1. Upload Your Look",
      grid: [
        {
          type: "text" as const,
          title: "SNAP & ANALYZE",
          lines: ["Take a photo", "AI scans instantly", "Any outfit works"],
          color: "primary",
        },
        {
          type: "image" as const,
          image: "/assets/1Product.png",
          label: "Detected items",
          color: "accent",
        },
      ],
    },
    {
      mainImage: "/assets/2Model.png",
      mainLabel: "2. AI Reads Your Style",
      grid: [
        {
          type: "text" as const,
          title: "STYLE SCORE",
          lines: ["Color harmony: 8/10", "Fit: 9/10", "Silhouette: 7/10"],
          color: "primary",
        },
        {
          type: "image" as const,
          image: "/assets/2Product.png",
          label: "Palette match",
          color: "accent",
        },
      ],
    },
    {
      mainImage: "/assets/3Model.png",
      mainLabel: "3. Get Your Verdict",
      grid: [
        {
          type: "text" as const,
          title: "CRITIQUE",
          lines: ["Strong proportions", "Elevate accessories", "Great layering"],
          color: "accent",
        },
        {
          type: "image" as const,
          image: "/assets/3Product.png",
          label: "Suggested fix",
          color: "primary",
        },
      ],
    },
    {
      mainImage: "/assets/1Product.png",
      mainLabel: "4. Agent Finds Matches",
      grid: [
        {
          type: "text" as const,
          title: "SHOPPING",
          lines: ["3 items found", "Within budget", "Ready to buy"],
          color: "primary",
        },
        {
          type: "image" as const,
          image: "/assets/2Model.png",
          label: "Best match",
          color: "accent",
        },
      ],
    },
    {
      mainImage: "/assets/2Product.png",
      mainLabel: "5. Share Your Look",
      grid: [
        {
          type: "text" as const,
          title: "SHARE",
          lines: ["Polaroid card", "Farcaster cast", "Download PNG"],
          color: "accent",
        },
        {
          type: "image" as const,
          image: "/assets/3Model.png",
          label: "Your style",
          color: "primary",
        },
      ],
    },
  ];

  const current = steps[step]!;

  return (
    <div className="relative rounded-2xl overflow-hidden border border-border/40 bg-gradient-to-br from-primary/[0.06] to-accent/[0.04] shadow-xl shadow-primary/10 p-6">
      <div className="absolute top-4 left-4 z-10 px-3 py-1 rounded-full bg-primary/90 text-white text-xs font-bold shadow-sm flex items-center gap-1">
        <Sparkles className="w-3 h-3" />
        AI Vision
      </div>

      <div className="absolute top-4 right-4 z-10">
        <PersonaChip persona={cyclingPersonas[step % cyclingPersonas.length]!} />
      </div>

      <div className="space-y-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={`main-${step}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="relative aspect-[4/3] rounded-lg overflow-hidden border border-border"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
            <Image
              src={current.mainImage}
              alt={current.mainLabel}
              fill
              className="object-cover opacity-90"
              unoptimized
            />
            <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-background/90 text-[10px] font-bold">
              {current.mainLabel}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="grid grid-cols-2 gap-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={`grid-left-${step}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4, delay: 0.05, ease: "easeInOut" }}
              className="relative aspect-square rounded-lg overflow-hidden border border-primary/20 bg-primary/5"
            >
              {current.grid[0]!.type === "text" && (
                <div className="p-3 space-y-1">
                  <div className="text-[10px] font-bold text-primary">
                    {current.grid[0]!.title}
                  </div>
                  {current.grid[0]!.lines.map((line, i) => (
                    <div key={i} className="text-[11px] text-muted-foreground">
                      {line}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.div
              key={`grid-right-${step}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4, delay: 0.1, ease: "easeInOut" }}
              className="relative aspect-square rounded-lg overflow-hidden border"
              style={{ borderColor: `hsl(var(--${current.grid[1]!.color}) / 0.2)` }}
            >
              {current.grid[1]!.type === "image" && (
                <>
                  <Image
                    src={current.grid[1]!.image}
                    alt={current.grid[1]!.label}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  <div
                    className="absolute bottom-2 left-2 px-2 py-1 rounded text-white text-[10px] font-bold"
                    style={{ backgroundColor: `hsl(var(--${current.grid[1]!.color}) / 0.9)` }}
                  >
                    {current.grid[1]!.label}
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Step dots */}
      <div className="flex justify-center gap-1.5 mt-3">
        {steps.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === step ? "w-4 bg-primary" : "w-1.5 bg-primary/30"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
