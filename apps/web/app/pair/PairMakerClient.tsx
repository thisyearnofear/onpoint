"use client";

import React, { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Shirt } from "lucide-react";
import { getShareAttribution } from "@/lib/utils/share-attribution";
import { ShareArtifact } from "@/components/ShareArtifact";

interface DeepItem {
  listingId: string;
  title: string;
  imageUrl: string | null;
  curatorSlug: string | null;
}

function FilePick({
  label,
  hint,
  onFile,
  preview,
}: {
  label: string;
  hint: string;
  onFile: (dataUrl: string) => void;
  preview: string | null;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const reader = new FileReader();
          reader.onload = () => onFile(reader.result as string);
          reader.readAsDataURL(f);
        }}
      />
      {preview ? (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="mt-3 block w-full overflow-hidden rounded-lg border border-border"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt={label} className="max-h-56 w-full object-cover" />
          <span className="block bg-card px-3 py-2 text-xs text-muted-foreground">Tap to swap</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="mt-3 flex min-h-24 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:border-foreground/40"
        >
          <Camera className="h-5 w-5" />
          Choose a photo
        </button>
      )}
    </div>
  );
}

export function PairMakerClient({ itemId, fromSlug }: { itemId: string | null; fromSlug: string | null }) {
  const [personPhoto, setPersonPhoto] = useState<string | null>(null);
  const [garmentPhoto, setGarmentPhoto] = useState<string | null>(null);
  const [deepItem, setDeepItem] = useState<DeepItem | null>(null);
  const [deepItemLoading, setDeepItemLoading] = useState(Boolean(itemId && fromSlug));
  const [caption, setCaption] = useState("");
  const [senderName, setSenderName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: string; pageUrl: string; senderRenderUrl: string } | null>(null);

  // Deep link: ?item=<listingId>&from=<curatorSlug> — resolve the listing
  // from the storefront so a shared piece can be the pair's garment.
  useEffect(() => {
    if (!itemId || !fromSlug) return;
    let cancelled = false;
    fetch(`/api/curator/${encodeURIComponent(fromSlug)}/storefront`)
      .then((r) => (r.ok ? r.json() : null))
      .then((sf) => {
        if (cancelled || !sf) return;
        const listing = (sf.listings || []).find((l: { id: string }) => l.id === itemId);
        if (listing) {
          setDeepItem({
            listingId: listing.id,
            title: listing.title || "the shared piece",
            imageUrl: listing.imageUrl || null,
            curatorSlug: listing.curatorSlug || fromSlug,
          });
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setDeepItemLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [itemId, fromSlug]);

  const hasGarment = Boolean(deepItem || garmentPhoto);
  const canSubmit = Boolean(personPhoto && hasGarment && !busy);

  const submit = async () => {
    if (!personPhoto || !hasGarment) return;
    setBusy(true);
    setError(null);
    try {
      const { sid, channel } = getShareAttribution();
      const res = await fetch("/api/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personPhotoData: personPhoto,
          ...(deepItem ? { listingId: deepItem.listingId } : { garmentPhotoData: garmentPhoto }),
          caption: caption || undefined,
          senderName: senderName || undefined,
          ...(sid ? { shareId: sid, shareChannel: channel } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "That didn't take — try again.");
      setResult({ id: data.id, pageUrl: data.pageUrl, senderRenderUrl: data.senderRenderUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't take — try again.");
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <div className="card-reveal border border-border bg-card p-6 text-center">
        {result.senderRenderUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={result.senderRenderUrl}
            alt="Your try-on render"
            className="mx-auto max-h-[480px] border border-border object-contain"
          />
        )}
        <p className="mt-5 font-display text-2xl">Your half is ready.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Send them this link — when they try it on too, the pair card makes itself.
        </p>
        <div className="mt-5 flex justify-center">
          <ShareArtifact title="Same fit, both of us" text="Try this on you — pair card" url={`/pair/${result.id}`} />
        </div>
        <p className="mt-4 break-all font-mono text-xs text-muted-foreground">{result.pageUrl}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 border border-border bg-card p-6">
      <FilePick
        label="1 · Your photo"
        hint="A clear full-body shot works best — this is what the garment lands on."
        preview={personPhoto}
        onFile={setPersonPhoto}
      />

      <div>
        <p className="text-sm font-semibold">2 · The garment</p>
        {deepItemLoading ? (
          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading the piece…
          </p>
        ) : deepItem ? (
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-border p-3">
            {deepItem.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={deepItem.imageUrl} alt={deepItem.title} className="h-16 w-16 rounded object-cover" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{deepItem.title}</p>
              {deepItem.curatorSlug && (
                <p className="text-xs text-muted-foreground">from {deepItem.curatorSlug}</p>
              )}
            </div>
            <Shirt className="h-4 w-4 shrink-0 text-muted-foreground" />
          </div>
        ) : (
          <div className="mt-3">
            <FilePick
              label=""
              hint="Snap the clothing — a rack photo, flat lay, or tag photo all work."
              preview={garmentPhoto}
              onFile={setGarmentPhoto}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Or arrive from a listing with <span className="font-mono">?item=…&amp;from=…</span> to pair on that piece.
            </p>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-semibold" htmlFor="pair-caption">
            Caption <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <input
            id="pair-caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={80}
            placeholder="his vs hers"
            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40"
          />
        </div>
        <div>
          <label className="text-sm font-semibold" htmlFor="pair-name">
            Your name <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <input
            id="pair-name"
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            maxLength={60}
            placeholder="the one who styled it"
            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40"
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-8 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Trying it on…
          </>
        ) : (
          "Make my half"
        )}
      </button>
      <p className="text-center text-xs text-muted-foreground">
        The render takes a moment — your link is ready when it lands.
      </p>
    </div>
  );
}
