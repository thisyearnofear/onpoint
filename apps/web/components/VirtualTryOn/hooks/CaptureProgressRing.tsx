"use client";

/**
 * CaptureProgressRing — circular SVG progress indicator overlaid on the
 * capture button. Shows how many of the user's allotted captures have been
 * used (free tier only).
 */
export function CaptureProgressRing({
  used,
  total,
}: {
  used: number;
  total: number;
}) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? Math.min(used / total, 1) : 0;
  const offset = circumference * (1 - progress);

  return (
    <svg
      className="absolute -inset-1 w-[calc(100%+8px)] h-[calc(100%+8px)] -rotate-90 pointer-events-none"
      viewBox="0 0 64 64"
      aria-hidden
    >
      <circle
        cx="32"
        cy="32"
        r={radius}
        stroke="rgba(255,255,255,0.15)"
        strokeWidth="3"
        fill="none"
      />
      <circle
        cx="32"
        cy="32"
        r={radius}
        stroke="white"
        strokeWidth="3"
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 400ms ease-out" }}
      />
    </svg>
  );
}
