"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { StagedWait } from "@/components/state/StagedWait";
import { getShareAttribution } from "@/lib/utils/share-attribution";

interface PairSummary {
  id: string;
  senderName: string | null;
  caption: string | null;
  garment: { title?: string; imageUrl?: string } | null;
  senderRenderUrl: string | null;
}

export function PairJoinClient({ pair }: { pair: PairSummary }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const swapRef = useRef<HTMLInputElement>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [swapPhoto, setSwapPhoto] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile =
    (set: (v: string) => void) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => set(reader.result as string);
      reader.readAsDataURL(f);
    };

  const submit = async () => {
    if (!photoData) return;
    setBusy(true);
    setError(null);
    try {
      const { sid } = getShareAttribution();
      const res = await fetch(`/api/pair/${pair.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personPhotoData: photoData,
          recipientName: name || undefined,
          ...(swapPhoto ? { garmentPhotoData: swapPhoto } : {}),
          ...(sid ? { shareId: sid } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "That didn't take — try again.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't take — try again.");
      setBusy(false);
    }
  };

  if (busy) {
    return (
      <StagedWait
        title="Trying it on you…"
        stages={[
          { at: 0, label: "Reading your photo" },
          { at: 15, label: "Dressing the render" },
          { at: 45, label: "Compositing the pair card" },
          { at: 90, label: "Almost there" },
        ]}
        lines={[
          "Same garment, different body — that's the point.",
          "The card builds itself when your half lands.",
        ]}
      />
    );
  }

  return (
    <div className="space-y-6 border border-border bg-card p-6">
      <div>
        <p className="text-sm font-semibold">Your photo</p>
        <p className="mt-1 text-xs text-muted-foreground">
          A clear full-body shot — the same garment lands on you.
        </p>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile(setPhotoData)} />
        {photoData ? (
          <button type="button" onClick={() => fileRef.current?.click()} className="mt-3 block w-full overflow-hidden rounded-lg border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoData} alt="Your photo" className="max-h-56 w-full object-cover" />
            <span className="block bg-card px-3 py-2 text-xs text-muted-foreground">Tap to swap</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mt-3 flex min-h-24 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:border-foreground/40"
          >
            <Camera className="h-5 w-5" />
            Choose a photo
          </button>
        )}
      </div>

      <div>
        <p className="text-sm font-semibold">
          Your name <span className="font-normal text-muted-foreground">(optional)</span>
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="the other half"
          className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40"
        />
      </div>

      <div>
        <p className="text-sm font-semibold">
          Swap the garment? <span className="font-normal text-muted-foreground">(optional)</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Snap a different piece and the card shows your pick instead.
        </p>
        <input ref={swapRef} type="file" accept="image/*" className="hidden" onChange={onFile(setSwapPhoto)} />
        {swapPhoto ? (
          <button type="button" onClick={() => swapRef.current?.click()} className="mt-3 block w-full overflow-hidden rounded-lg border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={swapPhoto} alt="Swap garment" className="max-h-32 w-full object-cover" />
            <span className="block bg-card px-3 py-2 text-xs text-muted-foreground">Tap to swap</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => swapRef.current?.click()}
            className="mt-3 flex min-h-16 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-foreground/40"
          >
            <Camera className="h-4 w-4" />
            Or snap your own piece
          </button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={!photoData}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-8 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Trying it on…
          </>
        ) : (
          "Wear it — make the card"
        )}
      </button>
    </div>
  );
}
