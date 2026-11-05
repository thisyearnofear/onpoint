"use client";

import React, { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";

export function MagazineClient({ looks }: { looks: Array<{ slug: string; title: string }> }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [recipientName, setRecipientName] = useState("");
  const [senderName, setSenderName] = useState("");
  const [note, setNote] = useState("");
  const [lookSlug, setLookSlug] = useState(looks[0]?.slug || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoData(reader.result as string);
    reader.readAsDataURL(f);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/magazine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoData: photoData || undefined,
          recipientName: recipientName || undefined,
          senderName: senderName || undefined,
          note: note || undefined,
          lookSlug: lookSlug || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "That didn't take — try again.");
      setUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't take — try again.");
    } finally {
      setBusy(false);
    }
  };

  if (url) {
    return (
      <div className="card-reveal border border-border bg-card p-6 text-center">
        <p className="font-display text-2xl">Her issue is ready.</p>
        <p className="mt-2 text-sm text-muted-foreground">Send her the link — she opens a magazine, not a list.</p>
        <a href={url} className="mt-5 inline-flex min-h-12 items-center rounded-full bg-primary px-8 text-sm font-bold text-white hover:bg-primary/90">
          Open it first
        </a>
        <p className="mt-4 break-all font-mono text-xs text-muted-foreground">{url}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 border border-border bg-card p-6">
      <div className="text-center">
        {photoData ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={photoData} alt="For the cover" className="mx-auto max-h-48 border border-border object-contain" />
        ) : null}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={`inline-flex min-h-10 items-center gap-2 rounded-full border border-border px-5 text-xs font-bold text-foreground hover:border-foreground ${photoData ? "mt-3" : ""}`}
        >
          <Camera className="h-4 w-4" /> {photoData ? "Change the cover photo" : "Add a cover photo — optional, hers is best"}
        </button>
      </div>
      <input
        value={recipientName}
        onChange={(e) => setRecipientName(e.target.value)}
        placeholder="Her name — goes on the cover"
        className="w-full border border-border bg-background px-4 py-3 text-sm outline-none focus:border-foreground"
      />
      <input
        value={senderName}
        onChange={(e) => setSenderName(e.target.value)}
        placeholder="Your name — the byline (optional)"
        className="w-full border border-border bg-background px-4 py-3 text-sm outline-none focus:border-foreground"
      />
      <select
        value={lookSlug}
        onChange={(e) => setLookSlug(e.target.value)}
        className="w-full border border-border bg-background px-4 py-3 text-sm outline-none focus:border-foreground"
      >
        {looks.map((l) => (
          <option key={l.slug} value={l.slug}>{l.title}</option>
        ))}
      </select>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="A note for the back page — say the thing"
        rows={3}
        className="w-full border border-border bg-background px-4 py-3 text-sm outline-none focus:border-foreground"
      />
      <button
        type="button"
        onClick={() => void submit()}
        disabled={busy}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {busy ? "Setting the pages…" : "Make the issue"}
      </button>
      {error && <p className="text-center text-xs text-error">{error}</p>}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
    </div>
  );
}
