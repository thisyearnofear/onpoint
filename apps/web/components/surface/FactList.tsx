import { ExternalLink } from "lucide-react";

export interface FactRow {
  label: React.ReactNode;
  value: React.ReactNode;
  /** When set, the value links out (e.g. an explorer URL). */
  href?: string;
  /** Monospace value — hashes, addresses, ids. */
  mono?: boolean;
  /** Semantic tone for the value (amount paid, payout, status). */
  tone?: "success" | "warning" | "info" | "muted";
}

export function shortHash(hash: string): string {
  return hash.length > 18 ? `${hash.slice(0, 8)}…${hash.slice(-6)}` : hash;
}

const TONES: Record<NonNullable<FactRow["tone"]>, string> = {
  success: "text-success",
  warning: "text-warning",
  info: "text-info",
  muted: "text-muted-foreground",
};

/**
 * Definition list with hairline dividers — no box per row. For receipts,
 * payment proofs, and any surface that lists facts. Hashes render shortened
 * in mono and stay tappable when `href` is set.
 */
export function FactList({ rows }: { rows: FactRow[] }) {
  return (
    <dl className="divide-y divide-border/60 border-y border-border/60">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-3">
          <dt className="shrink-0 text-xs text-muted-foreground">{row.label}</dt>
          <dd
            className={`min-w-0 truncate text-right text-sm ${
              row.mono ? "font-mono" : "font-medium"
            } ${row.tone ? TONES[row.tone] : "text-foreground"}`}
          >
            {row.href ? (
              <a
                href={row.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-primary hover:underline"
              >
                {row.value}
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            ) : (
              row.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
