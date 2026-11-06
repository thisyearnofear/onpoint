import React from "react";
import { Button } from "@repo/ui/button";

/**
 * The one error state. Voice rule: what happened, that it isn't the
 * user's fault, and the next move. `tone="warning"` is for degraded-but-
 * usable states (e.g. a low-quality photo you can analyze anyway).
 */
export function ErrorState({
  title,
  message,
  tone = "error",
  onDismiss,
  onRetry,
  actions,
  dismissLabel = "Dismiss",
  retryLabel = "Try again",
  className = "",
}: {
  title?: string;
  message: string;
  tone?: "error" | "warning";
  onDismiss?: () => void;
  onRetry?: () => void;
  /** Custom action row — replaces the default Dismiss/Try again buttons. */
  actions?: React.ReactNode;
  dismissLabel?: string;
  retryLabel?: string;
  className?: string;
}) {
  const isWarning = tone === "warning";
  const border = isWarning ? "border-warning/30" : "border-destructive";
  const bg = isWarning ? "bg-warning/10" : "bg-destructive/10";
  const text = isWarning ? "text-warning" : "text-destructive";
  const bodyText = isWarning ? "text-warning/90" : "text-destructive/90";

  return (
    <div className={`rounded-lg border ${border} ${bg} p-4 ${className}`}>
      {title && <p className={`text-sm font-medium ${text}`}>{title}</p>}
      <p className={`mt-1 text-xs ${bodyText}`}>{message}</p>
      {actions ? (
        <div className="mt-3 flex gap-2">{actions}</div>
      ) : (
        (onDismiss || onRetry) && (
          <div className="mt-3 flex gap-2">
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                {retryLabel}
              </Button>
            )}
            {onDismiss && (
              <Button variant="outline" size="sm" onClick={onDismiss}>
                {dismissLabel}
              </Button>
            )}
          </div>
        )
      )}
    </div>
  );
}
