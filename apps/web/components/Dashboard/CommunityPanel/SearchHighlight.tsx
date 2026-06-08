import React from "react";

export function highlightText(text: string, query: string): React.ReactNode[] {
  if (!query || query.length < 1) return [text];

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);

  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-amber-400/30 text-foreground rounded-sm px-0.5">
        {part}
      </mark>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    ),
  );
}

export function matchesSearch(
  look: { headline: string; takeaways: string[]; topics: string[] },
  query: string,
): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    look.headline.toLowerCase().includes(q) ||
    look.takeaways.some((t) => t.toLowerCase().includes(q)) ||
    look.topics.some((t) => t.toLowerCase().includes(q))
  );
}
