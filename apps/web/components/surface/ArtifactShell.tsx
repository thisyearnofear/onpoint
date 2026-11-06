import Link from "next/link";
import { Shirt } from "lucide-react";
import { PRODUCT_NAME } from "../../lib/brand";
import { PRIMARY_NAV } from "../../lib/navigation";

/**
 * The one shell for artifact surfaces (/c, /w, /gift, /try, /m, /p, /receipt).
 * Thin header (logo + the three places), then eyebrow → artifact → title so the
 * artifact lands on the first mobile screen instead of under a hero headline.
 * `stickyAction` pins the single main action to a safe-area-aware bottom bar.
 */
export function ArtifactShell({
  eyebrow,
  artifact,
  title,
  lede,
  children,
  exits,
  stickyAction,
}: {
  /** Small mono label above everything (e.g. "A gift for you"). */
  eyebrow?: React.ReactNode;
  /** The thing this page is about — edge-to-edge on phones, framed from sm. */
  artifact?: React.ReactNode;
  title?: React.ReactNode;
  lede?: React.ReactNode;
  children?: React.ReactNode;
  /** Next-loop links rendered after children (use <ExitLinks />). */
  exits?: React.ReactNode;
  /** The one main action — bottom bar on mobile and up. */
  stickyAction?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="border-b border-border/60 bg-background">
        <div className="mx-auto flex h-12 w-full max-w-xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="rounded-md border border-border p-1">
              <Shirt className="h-3.5 w-3.5 text-foreground" />
            </span>
            <span className="text-sm font-bold tracking-tight">
              {PRODUCT_NAME}
            </span>
          </Link>
          <nav className="flex items-center gap-1" aria-label="Primary">
            {PRIMARY_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main
        className={`mx-auto w-full max-w-xl flex-1 px-4 pt-4 md:pt-10 ${
          stickyAction ? "pb-28" : "pb-16"
        }`}
      >
        {eyebrow && (
          <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-primary">
            {eyebrow}
          </p>
        )}
        {artifact && <div className="-mx-4 mt-4 sm:mx-0">{artifact}</div>}
        {(title || lede) && (
          <header className={artifact ? "mt-6" : eyebrow ? "mt-3" : undefined}>
            {title && (
              <h1 className="font-display text-3xl leading-[1.05] tracking-[-0.02em] sm:text-4xl">
                {title}
              </h1>
            )}
            {lede && (
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {lede}
              </p>
            )}
          </header>
        )}
        {children}
        {exits}
      </main>

      {stickyAction && (
        <div className="sticky bottom-0 z-40 border-t border-border/60 bg-background/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="mx-auto w-full max-w-xl">{stickyAction}</div>
        </div>
      )}
    </div>
  );
}
