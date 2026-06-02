"use client";

import React from "react";
import { Globe } from "lucide-react";
import type { CuratedPick, PickProvenance } from "../../lib/utils/curated-picks";
import type { FashionItem, ExternalProduct } from "@onpoint/shared-types";

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
  const ext = pick.item as ExternalProduct;
  const handleClick = () => trackPickClick(pick, position);

  return (
    <a
      href={ext.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={`group flex items-start rounded-xl border border-border bg-card hover:border-primary/20 transition-all ${compact ? "gap-3 p-3" : "gap-4 p-4"}`}
    >
      {ext.imageUrl && (
        <div className={`rounded-lg overflow-hidden bg-muted shrink-0 ${compact ? "w-16 h-16" : "w-20 h-20"}`}>
          <img
            src={ext.imageUrl}
            alt={ext.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
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
        Visit →
      </span>
    </a>
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
        <div className="aspect-square bg-muted">
          <img
            src={item.modelSrc || item.productSrc}
            alt={item.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
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
