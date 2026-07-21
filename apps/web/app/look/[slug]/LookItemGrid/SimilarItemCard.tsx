import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SafeImage } from "../../../../components/SafeImage";
import { formatPrice } from "./utils";
import type { SimilarItem } from "./types";

interface SimilarItemCardProps {
  alt: SimilarItem;
  referralCode: string;
  lookSlug: string;
  onUse: () => void;
}

export function SimilarItemCard({
  alt,
  referralCode,
  lookSlug,
  onUse,
}: SimilarItemCardProps) {
  return (
    <div className="group space-y-2">
      <button
        type="button"
        onClick={onUse}
        className="relative aspect-square w-full overflow-hidden rounded-xl border border-border bg-muted text-left transition-all hover:border-foreground/20 hover:shadow-md"
      >
        <SafeImage
          sources={[alt.imageUrl]}
          alt={alt.title}
          fill
          unoptimized
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          fallbackIconSize={32}
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-black">
            Use this
          </span>
        </div>
      </button>
      <div className="space-y-0.5">
        <p className="text-xs font-bold leading-tight line-clamp-2">
          {alt.title}
        </p>
        <p className="text-[10px] text-muted-foreground">{alt.curatorName}</p>
        <p className="text-xs font-bold">{formatPrice(alt.lowestPrice)}</p>
      </div>
      <Link
        href={`/s/${alt.curatorSlug}?referral=${referralCode}&look=${lookSlug}`}
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        View storefront <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
