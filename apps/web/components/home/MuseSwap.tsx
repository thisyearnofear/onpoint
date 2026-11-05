"use client";

import React, { useRef, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";

const LS_PREFIX = "onpoint:muse:";

export function museFor(lookId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(LS_PREFIX + lookId);
  } catch {
    return null;
  }
}

export function clearMuse(lookId: string) {
  try {
    window.localStorage.removeItem(LS_PREFIX + lookId);
  } catch {
    /* private mode */
  }
}

export function MuseSwap({
  lookId,
  garmentImageUrl,
  onDone,
}: {
  lookId: string;
  garmentImageUrl: string;
  onDone: (renderUrl: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => void submit(reader.result as string);
    reader.readAsDataURL(f);
  };

  const submit = async (photoData: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/muse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoData, garmentImageUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Try-on failed");
      const url =
        data?.polaroid?.webUrl || data?.polaroid?.imageUrl || data?.renderUrl || data?.imageUrl || data?.url;
      if (!url) throw new Error("No render returned");
      try {
        window.localStorage.setItem(LS_PREFIX + lookId, url);
      } catch {
        /* private mode */
      }
      onDone(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't take — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-fuchsia-200 underline-offset-2 hover:underline disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
        {busy ? "Styling…" : "Make her the model"}
        <span className="sr-only"> — stays on this device</span>
      </button>
      {error && <span className="text-[10px] text-red-300">{error}</span>}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
    </span>
  );
}
