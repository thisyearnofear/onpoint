"use client";

import React, { useState } from "react";
import { Gift, Loader2 } from "lucide-react";

export function GiftClaimClient({ token }: { token: string }) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [size, setSize] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/gift/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, size: size || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Claim failed");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="border border-border bg-card p-6 text-center">
        <Gift className="mx-auto h-8 w-8 text-primary" />
        <p className="mt-3 font-display text-2xl">It&apos;s on its way.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Your delivery details are confirmed — the curator ships from here.
        </p>
        <a
          href="/couple"
          className="mt-4 inline-flex min-h-10 items-center rounded-full border border-border px-5 text-xs font-bold text-foreground hover:border-foreground"
        >
          Send one back — make a card for them
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="border border-border bg-card p-6">
      <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
        Where should it go?
      </p>
      <div className="mt-4 space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="w-full border border-border bg-background px-4 py-3 text-sm outline-none focus:border-foreground"
        />
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Delivery address"
          required
          rows={3}
          className="w-full border border-border bg-background px-4 py-3 text-sm outline-none focus:border-foreground"
        />
        <input
          value={size}
          onChange={(e) => setSize(e.target.value)}
          placeholder="Size (if they asked you)"
          className="w-full border border-border bg-background px-4 py-3 text-sm outline-none focus:border-foreground"
        />
      </div>
      {error && <p className="mt-3 text-xs text-error">{error}</p>}
      <button
        type="submit"
        disabled={busy || !address.trim()}
        className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 bg-primary px-6 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {busy ? "Confirming…" : "Claim the gift"}
      </button>
    </form>
  );
}
