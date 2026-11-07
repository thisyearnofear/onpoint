import React from "react";

/**
 * Page types for the lookbook. A page's *content* is arbitrary — these
 * helpers only own the editorial chrome: padding rhythm, eyebrow voice,
 * and the cover/back composition rules that make a book read as a book.
 */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
      {children}
    </p>
  );
}

/** Interior spread — eyebrow plus caller-composed content. */
export function Spread({
  eyebrow,
  children,
  className = "",
}: {
  eyebrow: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex h-full flex-col bg-card p-6 sm:p-8 ${className}`}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <div className="mt-4 flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

/**
 * Cover — the maximal page. Centered visual (the subject — a person, a
 * look), display headline, quiet byline. `children` is the visual block;
 * callers own the image treatment (object-contain, never a destructive crop).
 */
export function Cover({
  eyebrow,
  title,
  byline,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  byline?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col bg-card p-6 text-center sm:p-8">
      <Eyebrow>{eyebrow}</Eyebrow>
      {children && <div className="flex min-h-0 flex-1 items-center justify-center py-4">{children}</div>}
      <h1 className="font-display text-3xl leading-[1.05] tracking-[-0.02em] sm:text-4xl">{title}</h1>
      {byline && (
        <p className="mt-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">{byline}</p>
      )}
    </div>
  );
}

/** Back page — the colophon. Every issue ends on a next loop, never an afterword. */
export function BackPage({
  eyebrow = "The last page",
  children,
}: {
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col bg-card p-6 text-center sm:p-8">
      <Eyebrow>{eyebrow}</Eyebrow>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4">{children}</div>
    </div>
  );
}
