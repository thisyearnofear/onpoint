"use client";

import React from "react";
import { Camera, ScanLine, Sparkles, SlidersHorizontal, Share2, Check } from "lucide-react";

export type TryOnStage = "upload" | "analyze_fit" | "generate_look" | "refine" | "save_share";

interface ProgressRailProps {
  currentStage: TryOnStage;
}

const STAGES: { key: TryOnStage; label: string; icon: React.ElementType }[] = [
  { key: "upload", label: "Upload", icon: Camera },
  { key: "analyze_fit", label: "Analyze Fit", icon: ScanLine },
  { key: "generate_look", label: "Generate Look", icon: Sparkles },
  { key: "refine", label: "Refine", icon: SlidersHorizontal },
  { key: "save_share", label: "Save & Share", icon: Share2 },
];

const STAGE_ORDER: TryOnStage[] = ["upload", "analyze_fit", "generate_look", "refine", "save_share"];

function getStageIndex(stage: TryOnStage): number {
  return STAGE_ORDER.indexOf(stage);
}

export function ProgressRail({ currentStage }: ProgressRailProps) {
  const currentIndex = getStageIndex(currentStage);

  return (
    <>
      {/* Mobile: vertical */}
      <div className="md:hidden space-y-3 py-1">
        {STAGES.map((stage, i) => {
          const isCompleted = i < currentIndex;
          const isActive = i === currentIndex;
          const Icon = stage.icon;
          return (
            <div key={stage.key} className="flex items-center gap-2.5">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                  isCompleted
                    ? "bg-primary text-white"
                    : isActive
                    ? "bg-primary/20 text-primary animate-pulse"
                    : "bg-muted text-muted-foreground/40"
                }`}
              >
                {isCompleted ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3 w-3" />}
              </div>
              <span
                className={`text-xs font-medium transition-colors duration-300 ${
                  isCompleted
                    ? "text-primary"
                    : isActive
                    ? "text-primary"
                    : "text-muted-foreground/50"
                }`}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Desktop: horizontal */}
      <div className="hidden md:flex items-center justify-center gap-0 py-1">
        {STAGES.map((stage, i) => {
          const isCompleted = i < currentIndex;
          const isActive = i === currentIndex;
          const Icon = stage.icon;
          return (
            <React.Fragment key={stage.key}>
              {i > 0 && (
                <div
                  className={`w-6 h-px mx-1 transition-colors duration-300 ${
                    i <= currentIndex ? "bg-primary" : "bg-muted-foreground/20"
                  }`}
                />
              )}
              <div className="flex flex-col items-center gap-1.5 min-w-[60px]">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isCompleted
                      ? "bg-primary text-white"
                      : isActive
                      ? "bg-primary/20 text-primary animate-pulse"
                      : "bg-muted text-muted-foreground/40"
                  }`}
                >
                  {isCompleted ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                </div>
                <span
                  className={`text-[10px] font-medium text-center leading-tight transition-colors duration-300 ${
                    isCompleted
                      ? "text-primary"
                      : isActive
                      ? "text-primary"
                      : "text-muted-foreground/50"
                  }`}
                >
                  {stage.label}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </>
  );
}

/**
 * Derive the current TryOnStage from the orchestrator's boolean states.
 * Returns the highest-reached stage.
 */
export function deriveCurrentStage(state: {
  hasInput: boolean;
  analysis: unknown;
  enhancementLoading: boolean;
  tryOnResult: unknown;
  showPersonDescription: boolean;
  isAnalyzingPerson: boolean;
  showCritiqueModeSelection: boolean;
  showPersonalitySelection: boolean;
}): TryOnStage {
  if (state.tryOnResult) return "refine";
  if (state.enhancementLoading) return "generate_look";
  if (state.analysis) return "analyze_fit";
  if (state.showPersonDescription || state.isAnalyzingPerson) return "analyze_fit";
  if (state.showCritiqueModeSelection || state.showPersonalitySelection) return "analyze_fit";
  if (state.hasInput) return "analyze_fit";
  return "upload";
}
