"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Tags } from "lucide-react";
import { Busy } from "@/components/state";
import { getApiBase } from "../../../lib/utils/api-base";

/**
 * Quiet creator-facing controls for a look's generated assets. Both
 * endpoints are public and idempotent — regenerating recomposes the same
 * items, it doesn't create new content.
 */
export function LookRefreshControls({ lookSlug }: { lookSlug: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState<"collage" | "classify" | null>(null);
  const [failed, setFailed] = React.useState(false);

  const run = async (kind: "collage" | "classify") => {
    if (pending) return;
    setPending(kind);
    setFailed(false);
    try {
      const res = await fetch(
        `${getApiBase()}/api/looks/${encodeURIComponent(lookSlug)}/${kind}`,
        { method: "POST" },
      );
      if (res.ok) {
        router.refresh();
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setPending(null);
    }
  };

  const btn =
    "inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground disabled:opacity-50";

  return (
    <div className="flex items-center gap-2">
      {failed && (
        <span className="text-xs text-warning">Couldn&apos;t refresh — try again.</span>
      )}
      <button
        type="button"
        className={btn}
        disabled={pending !== null}
        onClick={() => run("collage")}
      >
        {pending === "collage" ? (
          <Busy label="Recomposing" />
        ) : (
          <>
            <RefreshCw className="h-3.5 w-3.5" />
            New collage
          </>
        )}
      </button>
      <button
        type="button"
        className={btn}
        disabled={pending !== null}
        onClick={() => run("classify")}
      >
        {pending === "classify" ? (
          <Busy label="Classifying" />
        ) : (
          <>
            <Tags className="h-3.5 w-3.5" />
            Re-tag
          </>
        )}
      </button>
    </div>
  );
}
