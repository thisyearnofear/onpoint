"use client";

import { useState } from "react";
import { Link2, Loader2, Check, X } from "lucide-react";
import { getApiBase } from "../../lib/utils/api-base";

interface CuratorLinkAgentProps {
  curatorSlug: string;
  whatsapp: string;
  currentLinkedAddress: string | null;
}

export function CuratorLinkAgent({
  curatorSlug,
  whatsapp,
  currentLinkedAddress,
}: CuratorLinkAgentProps) {
  const [address, setAddress] = useState(currentLinkedAddress || "");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);

  async function handleLink() {
    if (!address.trim() || !/^0x[a-fA-F0-9]{40}$/.test(address.trim())) return;
    setSubmitting(true);
    setResult(null);

    try {
      const res = await fetch(
        `${getApiBase()}/api/looks/curator/${curatorSlug}/link-agent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            whatsapp,
            agentAddress: address.trim(),
          }),
        },
      );

      const data = await res.json();
      if (res.ok && data.success) {
        setResult({ ok: true });
      } else {
        setResult({ ok: false, error: data.error || "Failed to link agent" });
      }
    } catch (err) {
      setResult({ ok: false, error: String(err) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-2xl rounded-2xl border border-border bg-muted/20 p-5">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-foreground/60" />
        <h3 className="text-sm font-bold">Link an Agent</h3>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Link an agent wallet address so looks created by that agent appear on your storefront.
        Set this to your own wallet to create looks yourself and earn referral commissions on top of sales.
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="0x..."
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-foreground/20"
        />
        <button
          type="button"
          onClick={handleLink}
          disabled={submitting || !address.trim() || !/^0x[a-fA-F0-9]{40}$/.test(address.trim())}
          className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-xs font-bold text-background transition-colors hover:bg-foreground/90 disabled:opacity-40"
        >
          {submitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Link2 className="h-3.5 w-3.5" />
          )}
          Link
        </button>
      </div>

      {result && (
        <div
          className={`mt-2 flex items-center gap-2 rounded-lg p-2 text-xs ${
            result.ok ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-error/10 text-red-700 dark:text-red-400"
          }`}
        >
          {result.ok ? (
            <>
              <Check className="h-3.5 w-3.5 shrink-0" />
              <span>Agent linked! Their looks will appear on your storefront.</span>
            </>
          ) : (
            <>
              <X className="h-3.5 w-3.5 shrink-0" />
              <span>{result.error}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
