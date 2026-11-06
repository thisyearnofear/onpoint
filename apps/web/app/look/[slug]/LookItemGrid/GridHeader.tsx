import { PriceReveal } from "../../../../components/PriceReveal";
import { getLowestPrice } from "./utils";
import type { LookItem } from "./types";

interface GridHeaderProps {
  items: LookItem[];
  curatorSlug: string | null;
  referralCode: string;
  lookSlug: string;
}

export function GridHeader({ items }: GridHeaderProps) {
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
        <PriceReveal
          kesAmount={totalPrice}
          label="See total"
          className="text-sm font-bold"
        />
      )}
    </div>
  );
}
