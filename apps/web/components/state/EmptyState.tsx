import React from "react";
import type { LucideIcon } from "lucide-react";

/**
 * The one empty state. Voice rule: name the absence, then hand over the
 * next action — never a dead screen, never "No data found."
 *
 *   <EmptyState
 *     icon={Shirt}
 *     title="No cards yet"
 *     body="The first one is yours to make."
 *     action={<Button …>Make a card</Button>}
 *   />
 */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className = "",
}: {
  icon?: LucideIcon;
  title: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 border border-dashed border-border px-6 py-10 text-center ${className}`}
    >
      {Icon && <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />}
      <p className="text-sm font-bold text-foreground">{title}</p>
      {body && <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
