"use client";

import { useEffect } from "react";
import { Button } from "@repo/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function CuratorStorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Storefront error:", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-rose-400" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black tracking-tight">
            Storefront unavailable
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This curator&apos;s storefront couldn&apos;t be loaded right now. It
            might be a temporary network issue or the curator&apos;s inventory
            is being updated.
          </p>
        </div>

        <Button
          onClick={reset}
          className="inline-flex items-center gap-2 bg-foreground text-background hover:bg-foreground/90 rounded-full px-6 py-3 font-bold"
        >
          <RefreshCw className="w-4 h-4" />
          Try again
        </Button>

        {error.digest && (
          <p className="text-[10px] text-muted-foreground/40 font-mono">
            Reference: {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}
