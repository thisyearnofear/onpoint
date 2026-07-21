import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { formatPrice, getLowestPrice } from "./utils";
import type { LookItem } from "./types";

interface GridHeaderProps {
  items: LookItem[];
  curatorSlug: string | null;
  referralCode: string;
  lookSlug: string;
}

export function GridHeader({ items, curatorSlug, referralCode, lookSlug }: GridHeaderProps) {
  const totalPrice = items.reduce(
    (sum, item) => sum + (getLowestPrice(item.sizes) ?? 0),
    0,
  );

  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
        The Look ({items.length} pieces)
      </h2>
      {totalPrice > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold">
            Total: {formatPrice(totalPrice)}
          </span>
          {curatorSlug ? (
            <Link
              href={`/s/${curatorSlug}?referral=${referralCode}&look=${lookSlug}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-bold text-background transition-colors hover:bg-foreground/90"
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              Shop this look
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
