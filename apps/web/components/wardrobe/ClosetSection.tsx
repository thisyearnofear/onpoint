"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Shirt } from "lucide-react";
import { Button } from "@repo/ui/button";
import { Lookbook, Cover, Spread, BackPage, type LookbookPage } from "../lookbook";
import { EmptyState, ErrorState, StagedWait } from "../state";
import { useToastOptional } from "../toast";
import { getApiBase } from "../../lib/utils/api-base";
import {
  CLOSET_FORMALITY,
  CLOSET_TYPES,
  CLOSET_WARMTH,
  MAX_CLOSET_ITEMS,
  closetToPlannerPayload,
  fileToClosetImage,
  readCloset,
  writeCloset,
  type ClosetItem,
} from "../../lib/wardrobe-closet";

interface PlannedItem {
  listingId: string;
  curatorSlug: string;
  title: string | null;
  slot: string | null;
  attributes: { type?: string; formality?: string | null; warmth?: string | null; colors?: string[] } | null;
  imageUrl: string | null;
  priceCusd: number | null;
  orderEndpoint: string | null;
  source?: string;
}

interface PlannedLook {
  title: string;
  items: PlannedItem[];
  totalCusd: number;
  score: number;
  why: string[];
}

const OCCASIONS = ["casual", "formal", "event", "sport", "outdoor", "travel"];

function closetImageFor(item: PlannedItem, closet: ClosetItem[]): string | null {
  if (item.source === "closet" || item.curatorSlug === "closet") {
    const match = /^closet-(\d+)$/.exec(item.listingId);
    if (match) {
      const piece = closet[Number(match[1])];
      if (piece) return piece.image;
    }
  }
  return item.imageUrl;
}

export function ClosetSection() {
  const [closet, setCloset] = useState<ClosetItem[]>([]);
  const [storageOk, setStorageOk] = useState(true);
  const [occasion, setOccasion] = useState("casual");
  const [looks, setLooks] = useState<PlannedLook[] | null>(null);
  const [state, setState] = useState<"idle" | "planning" | "ready" | "failed">("idle");
  const [status, setStatus] = useState("");
  const [dragging, setDragging] = useState(false);
  const [showWait, setShowWait] = useState(false);
  const { toast } = useToastOptional();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const pendingRef = useRef<ClosetItem[] | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const { items, available } = readCloset();
    setCloset(items);
    setStorageOk(available);
  }, []);

  // Flush any debounced write on unmount so a fast exit never loses pieces.
  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (pendingRef.current) writeCloset(pendingRef.current);
  }, []);

  // UI updates instantly; the ~500KB localStorage write is debounced so
  // every keystroke doesn't re-serialize the whole closet on mobile CPUs.
  const persist = (next: ClosetItem[]) => {
    setCloset(next);
    pendingRef.current = next;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      if (pendingRef.current) {
        setStorageOk(writeCloset(pendingRef.current));
        pendingRef.current = null;
      }
    }, 250);
  };

  const update = (id: string, patch: Partial<ClosetItem>) => {
    persist(closet.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const room = MAX_CLOSET_ITEMS - closet.length;
    if (room <= 0) {
      setStatus(`Closet is full — remove a piece to add another (max ${MAX_CLOSET_ITEMS}).`);
      return;
    }
    try {
      const additions: ClosetItem[] = [];
      for (const file of [...files].slice(0, room)) {
        const image = await fileToClosetImage(file);
        additions.push({
          id: `closet-${Date.now().toString(36)}-${additions.length}`,
          image,
          title: file.name.replace(/\.[^.]+$/, "").slice(0, 60) || `My piece ${closet.length + additions.length + 1}`,
          type: "top",
          formality: "casual",
          warmth: "medium",
          colors: [],
        });
      }
      persist([...closet, ...additions]);
      setStatus(`${additions.length} piece${additions.length === 1 ? "" : "s"} added — set each type so the planner can place it.`);
      // Retention-loop instrumentation (P2.2): closet adds are top-of-loop
      // for the style-around-what-you-own path. Fire-and-forget.
      void fetch("/api/loop/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "closet_add", meta: { count: additions.length } }),
      }).catch(() => {});
    } catch {
      setStatus("Could not read that photo — try a JPEG or PNG.");
    }
  };

  const plan = async () => {
    if (closet.length === 0) {
      setStatus("Add at least one of your own pieces first.");
      return;
    }
    setState("planning");
    setShowWait(false);
    setStatus("Styling your pieces against live inventory…");
    const ctrl = new AbortController();
    const timeout = window.setTimeout(() => ctrl.abort(), 45000);
    // The planner is usually fast — only stage the wait UI if it lingers.
    const waitTimer = window.setTimeout(() => setShowWait(true), 1200);
    try {
      const res = await fetch(`${getApiBase()}/api/agent/outfit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occasion, maxLooks: 3, closetItems: closetToPlannerPayload(closet) }),
        signal: ctrl.signal,
      });
      window.clearTimeout(timeout);
      window.clearTimeout(waitTimer);
      setShowWait(false);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { looks?: PlannedLook[] };
      setLooks(data.looks || []);
      setState("ready");
      void fetch("/api/loop/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "closet_plan", meta: { looks: (data.looks || []).length, occasion } }),
      }).catch(() => {});
      const count = (data.looks || []).length;
      setStatus(
        count === 0
          ? "No combo fit that brief — try a different occasion."
          : `${count} look${count === 1 ? "" : "s"} styled with your pieces.`,
      );
      if (count > 0) {
        requestAnimationFrame(() => {
          resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
          resultsRef.current?.focus({ preventScroll: true });
        });
      }
    } catch {
      window.clearTimeout(timeout);
      window.clearTimeout(waitTimer);
      setShowWait(false);
      setState("failed");
    }
  };

  const shareText = () => {
    if (!looks || looks.length === 0) return "";
    const lines = looks.map((look, i) => {
      const names = look.items.map((item) => item.title || item.slot || "piece").join(" + ");
      return `Look ${i + 1}: ${names} ($${look.totalCusd.toFixed(2)}${look.items.some((x) => x.source === "closet") ? ", incl. your own pieces" : ""})`;
    });
    return `My closet issue (${occasion})\n${lines.join("\n")}`;
  };

  const share = async () => {
    const text = shareText();
    if (!text) return;
    // The issue itself is device-local, but the share still needs a door —
    // recipients land on the wardrobe where the same loop starts.
    const url = typeof window !== "undefined" ? window.location.origin : "";
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "My closet issue", text, url });
        toast("Shared — enjoy your issue.", "success");
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${text}\n\n${url}`);
        toast("Copied — paste it anywhere to share your issue.", "success");
      } else {
        toast("Sharing isn't available here — screenshot your issue to share it.", "warning");
      }
    } catch {
      // Share sheet dismissed; not an error worth surfacing loudly.
    }
  };

  // Spreads only depend on plan data + closet images, so typing in a piece
  // editor or hovering drag state doesn't rebuild the whole issue.
  const spreadPages: LookbookPage[] = useMemo(() => (looks || []).map((look, i) => ({
    key: `look-${i}`,
    label: `Look ${i + 1}`,
    node: (
      <Spread eyebrow={`Look ${i + 1} · score ${look.score}`}>
        <p className="font-display text-xl leading-tight">{look.title}</p>
        <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
          {look.items.map((item) => {
            const src = closetImageFor(item, closet);
            const mine = item.source === "closet" || item.curatorSlug === "closet";
            return (
              <div key={item.listingId} className="flex items-center gap-3">
                {src ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={src} alt={item.title || "Piece"} loading="lazy" decoding="async" className="h-16 w-16 shrink-0 border border-border object-contain" />
                ) : (
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center border border-border bg-muted/40 text-xs text-muted-foreground">
                    {item.slot || "piece"}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">
                    {item.title || "Untitled"}
                    {mine && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-primary">yours</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.slot || "piece"} · {mine || !item.priceCusd ? "already owned" : `$${Number(item.priceCusd).toFixed(2)} · ${item.curatorSlug}`}
                  </p>
                  {!mine && item.curatorSlug && item.curatorSlug !== "closet" && (
                    <Link
                      href={`/s/${encodeURIComponent(item.curatorSlug)}?item=${encodeURIComponent(item.listingId)}`}
                      className="text-xs font-bold text-primary underline-offset-4 hover:underline"
                    >
                      Shop this piece
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
          {look.why.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
              {look.why.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      </Spread>
    ),
  })), [closet, looks]);

  const pages: LookbookPage[] = [...spreadPages];

  if (looks && looks.length > 0) {
    pages.unshift({
      key: "cover",
      label: "Cover",
      node: (
        <Cover eyebrow="My closet issue" title="Styled with what's yours." byline={`${occasion} · ${closet.length} own ${closet.length === 1 ? "piece" : "pieces"}`}>
          <div className="flex items-center justify-center gap-2">
            {closet.map((piece) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img key={piece.id} src={piece.image} alt={piece.title} loading="lazy" decoding="async" className="h-20 w-20 border border-border object-contain sm:h-24 sm:w-24" />
            ))}
          </div>
        </Cover>
      ),
    });
    pages.push({
      key: "back",
      label: "The last page",
      node: (
        <BackPage>
          <p className="font-display text-2xl italic leading-snug">Your closet did half the work.</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button onClick={share} className="rounded-full px-8">
              Share this issue
            </Button>
            <Button variant="outline" onClick={() => { setLooks(null); setState("idle"); }} className="rounded-full px-8">
              Restyle
            </Button>
          </div>
          <Link href="/lab?tab=try-on" className="text-xs font-bold text-primary hover:underline">
            Try a pick on yourself in the fitting room
          </Link>
        </BackPage>
      ),
    });
  }

  return (
    <section
      aria-label="My closet"
      onDragOver={(e) => { if (e.dataTransfer?.types.includes("Files")) { e.preventDefault(); setDragging(true); } }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); void addFiles(e.dataTransfer?.files ?? null); }}
      className={`rounded-2xl border bg-card p-4 transition-colors sm:p-5 ${dragging ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-bold leading-tight">My closet · on this device</h3>
        <span className="shrink-0 font-mono text-xs text-muted-foreground" aria-label={`${closet.length} of ${MAX_CLOSET_ITEMS} pieces`}>{closet.length}/{MAX_CLOSET_ITEMS}</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Up to {MAX_CLOSET_ITEMS} of your own pieces. Photos stay in this browser — only fit metadata is planned against.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        aria-label="Add your own pieces"
        onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }}
      />

      {closet.length === 0 ? (
        <EmptyState
          icon={Shirt}
          title="Your closet is empty"
          body="Drop a photo, set its type, style it with live picks — or drag & drop a photo anywhere in this card. Photos stay in this browser."
          action={
            <Button onClick={() => fileRef.current?.click()} className="rounded-full px-6">
              Add your first piece
            </Button>
          }
          className="mt-3 rounded-2xl"
        />
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {closet.map((piece) => (
            <div key={piece.id} className="flex gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={piece.image} alt={piece.title} decoding="async" className="h-16 w-16 shrink-0 border border-border object-contain sm:h-20 sm:w-20" />
              <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
                <label className="col-span-2 text-xs font-semibold">
                  Name
                  <input
                    value={piece.title}
                    maxLength={60}
                    onChange={(e) => update(piece.id, { title: e.target.value })}
                    className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-base font-normal sm:text-sm"
                  />
                </label>
                <label className="text-xs font-semibold">
                  Type
                  <select
                    value={piece.type}
                    onChange={(e) => update(piece.id, { type: e.target.value as ClosetItem["type"] })}
                    className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-base font-normal sm:text-sm"
                  >
                    {CLOSET_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold">
                  Warmth
                  <select
                    value={piece.warmth}
                    onChange={(e) => update(piece.id, { warmth: e.target.value })}
                    className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-base font-normal sm:text-sm"
                  >
                    {CLOSET_WARMTH.map((w) => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold">
                  Formality
                  <select
                    value={piece.formality}
                    onChange={(e) => update(piece.id, { formality: e.target.value })}
                    className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-base font-normal sm:text-sm"
                  >
                    {CLOSET_FORMALITY.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </label>
                <label className="col-span-2 text-xs font-semibold">
                  Colors <span className="font-normal text-muted-foreground">(comma-separated)</span>
                  <input
                    value={piece.colors.join(", ")}
                    placeholder="white, blue"
                    onChange={(e) => update(piece.id, { colors: e.target.value.split(",").map((c) => c.trim()).filter(Boolean).slice(0, 3) })}
                    className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-base font-normal sm:text-sm"
                  />
                </label>
                <Button
                  variant="link"
                  aria-label={`Remove ${piece.title}`}
                  onClick={() => persist(closet.filter((c) => c.id !== piece.id))}
                  className="col-span-2 h-auto min-h-0 justify-self-start px-0 text-xs text-muted-foreground"
                >
                  Remove this piece
                </Button>
              </div>
            </div>
          ))}
          {closet.length < MAX_CLOSET_ITEMS && (
            <Button variant="outline" onClick={() => fileRef.current?.click()} className="rounded-full px-6">
              Add another · {MAX_CLOSET_ITEMS - closet.length} of {MAX_CLOSET_ITEMS} left
            </Button>
          )}
        </div>
      )}

      {closet.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <label className="text-xs font-semibold">
            Occasion
            <select
              value={occasion}
              onChange={(e) => setOccasion(e.target.value)}
              className="ml-2 min-h-11 rounded-full border border-border bg-background px-3 py-2 text-base sm:text-sm"
            >
              {OCCASIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </label>
          <Button
            onClick={plan}
            loading={state === "planning"}
            className="rounded-full px-6"
          >
            {state === "planning" ? "Styling…" : `Style my closet${closet.length > 0 ? ` · ${looks ? "restyle" : `${closet.length} piece${closet.length === 1 ? "" : "s"}`}` : ""}`}
          </Button>
        </div>
      )}

      {!storageOk && (
        <p className="mt-2 text-xs text-muted-foreground">Browser storage is unavailable — pieces will last for this visit only.</p>
      )}
      {state === "planning" && showWait && (
        <StagedWait
          bare
          title="Styling your pieces"
          stages={[
            { at: 0, label: "Reading your pieces", detail: "Type, warmth and colors" },
            { at: 8, label: "Matching live picks", detail: "Tops, bottoms and layers" },
            { at: 20, label: "Laying out your issue", detail: "Cover, spreads, back page" },
          ]}
          lines={["Your photos never leave this browser.", "Already-owned pieces are always free."]}
          className="mt-2"
        />
      )}
      {state === "failed" ? (
        <ErrorState
          title="Styling didn't work"
          message="Your pieces are still here — check your connection and try again."
          onRetry={plan}
          retryLabel="Try again"
          className="mt-2"
        />
      ) : (
        <p className="mt-2 text-xs text-muted-foreground" role="status" aria-live="polite">{status}</p>
      )}

      {state === "ready" && looks && looks.length > 0 && (
        <div ref={resultsRef} tabIndex={-1} aria-label="Your styled looks" className="card-reveal soft-shadow mt-4 outline-none">
          <Lookbook pages={pages} />
        </div>
      )}
    </section>
  );
}
