"use client";

import React, { useRef, useState } from "react";
import { ExternalLink, Star, TrendingDown } from "lucide-react";
import type { ProductResult } from "@onpoint/shared-types";

interface RichProductCardProps {
  product: ProductResult;
  badge?: string;
  lowestPrice?: number;
  onClick?: () => void;
}

/**
 * Rich product card for externally-discovered items.
 * Shows product image, name, price, source, and a link to shop.
 * When grouped with siblings, shows price comparison context.
 */
export function RichProductCard({
  product,
  badge,
  lowestPrice,
  onClick,
}: RichProductCardProps) {
  const cardRef = useRef<HTMLAnchorElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [imgError, setImgError] = useState(false);

  const isBestPrice =
    lowestPrice !== undefined &&
    product.price > 0 &&
    product.price <= lowestPrice;

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: y * -8, y: x * 8 });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
    setIsHovered(false);
  };

  return (
    <a
      ref={cardRef}
      href={product.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="group relative flex items-start gap-3 p-3 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 hover:border-muted-foreground/30 transition-all text-left"
      style={{ perspective: "600px" }}
    >
      {/* Badge */}
      {badge && (
        <div className="absolute top-2 left-2 z-10 px-1.5 py-0.5 rounded-full bg-purple-500/90 text-white text-[8px] font-bold shadow-lg">
          {badge}
        </div>
      )}

      {/* Best price indicator */}
      {isBestPrice && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30">
          <TrendingDown className="w-2.5 h-2.5 text-emerald-400" />
          <span className="text-[8px] text-emerald-300 font-bold">
            Best Price
          </span>
        </div>
      )}

      {/* Product image */}
      <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted shrink-0 flex items-center justify-center">
        {product.image_url && !imgError ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/10 to-indigo-500/10">
            <ExternalLink className="w-5 h-5 text-muted-foreground/30" />
          </div>
        )}
      </div>

      {/* Product info */}
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-xs font-medium text-foreground line-clamp-2 leading-snug">
          {product.name}
        </p>
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-bold ${isBestPrice ? "text-emerald-400" : "text-amber-400"}`}
          >
            {product.currency === "USD" || !product.currency
              ? "$"
              : `${product.currency} `}
            {product.price.toFixed(2)}
          </span>
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border">
            {product.source}
          </span>
        </div>
      </div>

      {/* Shop arrow */}
      <div className="shrink-0 self-center">
        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-purple-400 transition-colors" />
      </div>
    </a>
  );
}

/**
 * Renders a group of related products with price comparison.
 * Shows the cheapest option highlighted and a price range summary.
 */
export function RichProductGroup({
  title,
  products,
}: {
  title: string;
  products: ProductResult[];
}) {
  if (products.length === 0) return null;

  const sorted = [...products].sort((a, b) => a.price - b.price);
  const lowestPrice = sorted[0]?.price ?? 0;
  const highestPrice = sorted[sorted.length - 1]?.price ?? 0;
  const hasRange = lowestPrice !== highestPrice && lowestPrice > 0;

  return (
    <div className="space-y-2">
      {/* Group header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-foreground line-clamp-1">{title}</p>
        {hasRange && (
          <span className="text-[10px] text-muted-foreground">
            ${lowestPrice.toFixed(0)}–${highestPrice.toFixed(0)} across{" "}
            {sorted.length} stores
          </span>
        )}
      </div>

      {/* Product cards */}
      <div className="space-y-1.5">
        {sorted.map((product, i) => (
          <RichProductCard
            key={`${product.source}-${i}`}
            product={product}
            lowestPrice={lowestPrice}
            badge={i === 0 && sorted.length > 1 ? "Best Price" : undefined}
          />
        ))}
      </div>
    </div>
  );
}
