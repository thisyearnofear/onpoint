"use client";

import React, { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";

interface LookOption {
  slug: string;
  title: string;
}

export function CoupleClient({ looks }: { looks: LookOption[] }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [lookSlug, setLookSlug] = useState(looks[0]?.slug || "");
  const [theme, setTheme] = useState("");
  const [senderName, setSenderName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ cardUrl: string; pageUrl: string } | null>(null);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoData(reader.result as string);
    reader.readAsDataURL(f);
  };

  const submit = async () => {
    if (!photoData || !lookSlug) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/couple/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoData, lookSlug, theme: theme || undefined, senderName: senderName || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Render failed");
      setResult({ cardUrl: data.cardUrl, pageUrl: data.pageUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't take — try again.");
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <div className="card-reveal border border-border bg-card p-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={result.cardUrl} alt="Your couple goals card" className="mx-auto max-h-[520px] border border-border object-contain" />
        <a
          href={result.pageUrl}
          className="mt-5 inline-flex min-h-12 items-center rounded-full bg-primary px-8 text-sm font-bold text-white hover:bg-primary/90"
        >
          Open the share card
        </a>
        <p className="mt-3 text-xs text-muted-foreground">Send her the link — the card is the share.</p>
      </div>
    );
  }

  return (
    <div className="border border-border bg-card p-6">
      {photoData ? (
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoData} alt="You two" className="mx-auto max-h-64 border border-border object-contain" />
          <div className="mt-4 space-y-3">
            <select
              value={lookSlug}
              onChange={(e) => setLookSlug(e.target.value)}
              className="w-full border border-border bg-background px-4 py-3 text-sm outline-none focus:border-foreground"
            >
              {looks.map((l) => (
                <option key={l.slug} value={l.slug}>{l.title}</option>
              ))}
            </select>
            <input
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="Theme — e.g. Date night (optional)"
              className="w-full border border-border bg-background px-4 py-3 text-sm outline-none focus:border-foreground"
            />
            <input
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="Your name — shown as styled by (optional)"
              className="w-full border border-border bg-background px-4 py-3 text-sm outline-none focus:border-foreground"
            />
          </div>
          <div className="mt-4 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => setPhotoData(null)}
              className="inline-flex min-h-12 items-center rounded-full border border-border px-6 text-sm font-bold text-foreground hover:border-foreground"
            >
              Retake
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy || !lookSlug}
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {busy ? "Styling…" : "Make the card"}
            </button>
          </div>
          {error && <p className="mt-3 text-center text-xs text-error">{error}</p>}
        </div>
      ) : (
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            One photo of the two of you + a look. The card does the rest.
          </p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-white hover:bg-primary/90"
          >
            <Camera className="h-5 w-5" /> Add a photo
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mt-3 block w-full text-xs font-bold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            or pick from your library
          </button>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
    </div>
  );
}
