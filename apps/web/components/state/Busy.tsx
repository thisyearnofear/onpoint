import React from "react";
import { Spinner, type SpinnerSize, type SpinnerTone } from "./Spinner";

/**
 * Inline busy indicator for buttons, rows, and short waits (<5s):
 * spinner + present-progressive label. Pass the verb phrase without
 * punctuation — the ellipsis is added for you.
 *
 *   <Busy label="Generating try-on" />
 *   <Busy label="Checking photo quality" size="sm" />
 *
 * For waits longer than ~5s use <StagedWait> instead — a static busy
 * line on a long generation is the patchiness this kit exists to kill.
 */
export function Busy({
  label,
  size = "sm",
  tone = "default",
  className = "",
}: {
  label: string;
  size?: SpinnerSize;
  /** "inverse" for use on filled/primary backgrounds. */
  tone?: SpinnerTone;
  className?: string;
}) {
  const textTone = tone === "inverse" ? "text-primary-foreground" : "text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-2 text-xs ${textTone} ${className}`}>
      <Spinner size={size} tone={tone} />
      <span>{/[.…!?,;:]$/.test(label) ? label : `${label}…`}</span>
    </span>
  );
}
