import React from "react";

export type SpinnerSize = "sm" | "md" | "lg" | "xl";
export type SpinnerTone = "default" | "inverse";

const SIZE_CLASSES: Record<SpinnerSize, string> = {
  sm: "h-3 w-3 border",
  md: "h-4 w-4 border-2",
  lg: "h-8 w-8 border-2",
  xl: "h-12 w-12 border-2",
};

const TONE_CLASSES: Record<SpinnerTone, string> = {
  default: "border-primary/30 border-t-primary",
  inverse: "border-white/30 border-t-white",
};

/**
 * The one spinner. Replaces every hand-rolled
 * `border-t-* rounded-full animate-spin` div — if you need a different
 * look, extend this component, don't fork it.
 */
export function Spinner({
  size = "md",
  tone = "default",
  className = "",
}: {
  size?: SpinnerSize;
  tone?: SpinnerTone;
  className?: string;
}) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block shrink-0 animate-spin rounded-full ${SIZE_CLASSES[size]} ${TONE_CLASSES[tone]} ${className}`}
    />
  );
}
