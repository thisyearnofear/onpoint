import Link from "next/link";
import { Shuffle } from "lucide-react";
import { SafeImage } from "../../../../components/SafeImage";
import { formatPrice, getLowestPrice } from "./utils";
import type { LookItem } from "./types";

interface ItemCardProps {
  item: LookItem;
  referralCode: string;
  lookSlug: string;
  onSwap: (item: LookItem) => void;
}

export function ItemCard({ item, referralCode, lookSlug, onSwap }: ItemCardProps) {
  const price = getLowestPrice(item.sizes);

  return (
    <div className="group relative space-y-2">
      <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-muted transition-all hover:border-foreground/20 hover:shadow-md focus-within:ring-2 focus-within:ring-foreground/20">
        <Link
          href={`/s/${item.curatorSlug}?referral=${referralCode}&look=${lookSlug}#${item.id}`}
          className="relative block h-full w-full"
        >
          <SafeImage
            sources={[item.imageUrl]}
            alt={item.title}
            fill
            unoptimized
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            fallbackIconSize={32}
          />
          {item.isHero && (
            <span className="absolute left-2 top-2 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold uppercase text-background">
              Hero
            </span>
          )}
        </Link>

        <button
          type="button"
          onClick={() => onSwap(item)}
          className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-xs font-bold text-black opacity-100 shadow-sm transition-opacity duration-200 hover:bg-white group-hover:opacity-100 focus:opacity-100 sm:opacity-0"
          aria-label={`Swap ${item.title}`}
        >
          <Shuffle className="h-3 w-3" />
          Swap
        </button>
      </div>

      <div className="space-y-0.5">
        <h3 className="text-xs font-bold leading-tight line-clamp-2">
          {item.title}
        </h3>
        <p className="text-[11px] capitalize text-muted-foreground">
          {item.curatorSlug}
          {item.kit?.brand && ` · ${item.kit.brand}`}
        </p>
        {(price ?? 0) > 0 && (
          <p className="text-xs font-bold">{formatPrice(price)}</p>
        )}
      </div>
    </div>
  );
}
