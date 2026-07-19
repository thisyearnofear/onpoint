"use client";

import React, { useState } from "react";
import { Globe, X, ExternalLink } from "lucide-react";
import type { CuratedPick, PickProvenance } from "../../lib/utils/curated-picks";
import type { FashionItem, ExternalProduct } from "@onpoint/shared-types";
import { SafeImage } from "../SafeImage";

function trackPickClick(pick: CuratedPick, position: number) {
  const item = pick.item;
  const category = "category" in item ? item.category : "";
  const price = "price" in item ? item.price : 0;

  fetch("/api/agent/style", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, price }),
  }).catch(() => {});
}

export function ProvenanceBar({ provenance, pickCount, hasExternal }: {
  provenance?: PickProvenance;
  pickCount: number;
  hasExternal: boolean;
}) {
  if (!provenance) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {provenance.personaLabel && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">
          {provenance.personaLabel}
        </span>
      )}
      {provenance.goalLabel && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-accent/10 text-accent">
          {provenance.goalLabel}
        </span>
      )}
      <span className="text-[10px] text-muted-foreground">
        {pickCount} picks from {hasExternal ? "live stores + " : ""}catalog
      </span>
    </div>
  );
}

export function ExternalPickCard({ pick, position, compact = false }: {
  pick: CuratedPick;
  position: number;
  compact?: boolean;
}) {
  const [showModal, setShowModal] = useState(false);
  const ext = pick.item as ExternalProduct;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          trackPickClick(pick, position);
          setShowModal(true);
        }}
        className={`group flex items-start rounded-xl border border-border bg-card hover:border-primary/20 transition-all text-left w-full ${compact ? "gap-3 p-3" : "gap-4 p-4"}`}
      >
        {ext.imageUrl && (
          <div className={`relative rounded-lg overflow-hidden bg-muted shrink-0 ${compact ? "w-16 h-16" : "w-20 h-20"}`}>
            <SafeImage
              sources={[ext.imageUrl]}
              alt={ext.name}
              fill
              unoptimized
              className="object-cover group-hover:scale-105 transition-transform"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className={`${compact ? "text-xs" : "text-sm"} font-medium text-foreground line-clamp-2`}>{ext.name}</p>
          <p className={`${compact ? "text-[10px]" : "text-xs"} text-muted-foreground mt-0.5`}>{pick.reason}</p>
          {pick.provenance?.matchedTakeaway && (
            <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] bg-primary/5 text-muted-foreground border border-primary/10">
              Matched: {pick.provenance.matchedTakeaway}
            </span>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className={`${compact ? "text-xs" : "text-sm"} font-bold text-primary`}>${ext.price}</span>
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex items-center gap-1">
              <Globe className="w-2.5 h-2.5" />
              {ext.source}
            </span>
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground group-hover:text-primary transition-colors shrink-0 self-center">
          View →
        </span>
      </button>
      {showModal && (
        <ProductDetailModal pick={pick} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}

function ProductDetailModal({ pick, onClose }: {
  pick: CuratedPick;
  onClose: () => void;
}) {
  const ext = pick.item as ExternalProduct;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-background border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center justify-between z-10">
          <h3 className="text-sm font-bold text-foreground truncate pr-4">{ext.name}</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {ext.imageUrl && (
          <div className="relative aspect-square bg-muted">
            <SafeImage sources={[ext.imageUrl]} alt={ext.name} fill unoptimized className="object-contain" />
          </div>
        )}

        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-primary">${ext.price}</span>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full flex items-center gap-1">
              <Globe className="w-3 h-3" />
              {ext.source}
            </span>
          </div>

          <p className="text-sm text-muted-foreground">{pick.reason}</p>

          {pick.provenance && (
            <div className="flex flex-wrap gap-1.5">
              {pick.provenance.personaLabel && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">{pick.provenance.personaLabel}</span>
              )}
              {pick.provenance.goalLabel && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-accent/10 text-accent">{pick.provenance.goalLabel}</span>
              )}
              {pick.provenance.matchedTakeaway && (
                <span className="px-2 py-0.5 rounded text-[10px] bg-muted text-muted-foreground border border-border">{pick.provenance.matchedTakeaway}</span>
              )}
            </div>
          )}

          <a
            href={ext.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Buy from {ext.source}
          </a>

          <p className="text-[10px] text-center text-muted-foreground">
            You&apos;ll be redirected to {ext.source} to complete your purchase
          </p>
        </div>
      </div>
    </div>
  );
}

export function LocalPickCard({ pick, onClick }: {
  pick: CuratedPick;
  onClick: (item: FashionItem) => void;
}) {
  const item = pick.item as FashionItem;

  return (
    <button
      data-pick-id={item.id}
      onClick={() => {
        trackPickClick(pick, 0);
        onClick(item);
      }}
      className="group rounded-xl overflow-hidden border border-border bg-card hover:border-primary/20 transition-all text-left"
    >
      {(item.modelSrc || item.productSrc) && (
        <div className="relative aspect-square bg-muted">
          <SafeImage
            sources={[item.modelSrc, item.productSrc]}
            alt={item.name}
            fill
            unoptimized
            className="object-cover group-hover:scale-105 transition-transform"
          />
        </div>
      )}
      <div className="p-2">
        <p className="text-[11px] text-foreground font-medium truncate">{item.name}</p>
        <p className="text-[11px] font-bold text-primary">${item.price}</p>
        <p className="text-[9px] text-muted-foreground mt-0.5 line-clamp-1">{pick.reason}</p>
        {pick.provenance?.matchedTakeaway && (
          <p className="text-[8px] text-muted-foreground/70 mt-0.5 truncate">via {pick.provenance.matchedTakeaway}</p>
        )}
      </div>
    </button>
  );
}
