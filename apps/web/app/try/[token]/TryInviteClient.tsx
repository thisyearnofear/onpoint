"use client";

import React, { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";

function CaptureOptIn({ source }: { source: string }) {
  const [value, setValue] = useState("");
  const [done, setDone] = useState(false);
  const submit = async () => {
    const channel = value.includes("@") ? "email" : "whatsapp";
    if (!value.trim()) return;
    const res = await fetch("/api/loop/capture", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel, contact: value, source }) });
    if (res.ok) setDone(true);
  };
  if (done) return <p className="mt-3 text-xs font-bold text-success">We&apos;ll send it to you.</p>;
  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="text-xs text-muted-foreground">Get this render by WhatsApp or email:</p>
      <div className="mt-2 flex gap-2">
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="+254… or you@mail.com" className="min-w-0 flex-1 border border-border bg-background px-3 py-2 text-xs outline-none focus:border-foreground" />
        <button type="button" onClick={() => void submit()} className="shrink-0 border border-border px-4 text-xs font-bold text-foreground hover:border-foreground">Send</button>
      </div>
    </div>
  );
}

export function TryInviteClient({
  token,
  listingImageUrl,
  curatorSlug,
  listingId,
}: {
  token: string;
  listingImageUrl: string | null;
  curatorSlug?: string;
  listingId?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoData(reader.result as string);
    reader.readAsDataURL(f);
  };

  const submit = async () => {
    if (!photoData) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/try-on/invite/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoData, garmentImageUrl: listingImageUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Try-on failed");
      const url =
        data?.polaroid?.webUrl || data?.polaroid?.imageUrl || data?.renderUrl || data?.imageUrl || data?.url;
      setResultUrl(url || null);
      fetch("/api/loop/event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "invite_rendered", meta: { token: token.slice(0, 16) } }) }).catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  if (resultUrl) {
    return (
      <div className="card-reveal border border-border bg-card p-6 text-center">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-primary">Your look</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={resultUrl} alt="Your try-on result" className="mx-auto mt-4 max-h-[420px] border border-border object-contain" />
        <p className="mt-4 text-xs text-muted-foreground">Your photo was styled and discarded — never stored.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          {curatorSlug && (
            <a
              href={`/s/${curatorSlug}${listingId ? `?item=${listingId}` : ""}`}
              className="inline-flex min-h-10 items-center rounded-full bg-primary px-5 text-xs font-bold text-white hover:bg-primary/90"
            >
              Get the piece
            </a>
          )}
          <a
            href="/couple"
            className="inline-flex min-h-10 items-center rounded-full border border-border px-5 text-xs font-bold text-foreground hover:border-foreground"
          >
            Make a couple card
          </a>
        </div>
        <CaptureOptIn source="try-invite" />
      </div>
    );
  }

  return (
    <div className="border border-border bg-card p-6">
      {photoData ? (
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoData} alt="Your photo" className="mx-auto max-h-72 border border-border object-contain" />
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
              disabled={busy}
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {busy ? "Styling…" : "See it on me"}
            </button>
          </div>
          {error && <p className="mt-3 text-xs text-error">{error}</p>}
        </div>
      ) : (
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            One full-length photo. It&apos;s styled and discarded — never stored.
          </p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-white hover:bg-primary/90"
          >
            <Camera className="h-5 w-5" /> Take a photo
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
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
    </div>
  );
}
