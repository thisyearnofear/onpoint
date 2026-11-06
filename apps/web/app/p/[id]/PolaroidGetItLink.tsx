"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { TransitionLink } from "@/components/ViewTransition";
import { captureShareAttribution } from "@/lib/utils/share-attribution";

/**
 * The last hop of a shared polaroid. Whoever opened it arrived with `?sid=`, so
 * the storefront link must carry it — otherwise the share that drove the try-on
 * disappears from the chain one click before the order.
 */
export function PolaroidGetItLink({
  curatorSlug,
  curatorName,
  listingId,
}: {
  curatorSlug: string;
  curatorName: string;
  listingId: string;
}) {
  const base = `/s/${encodeURIComponent(curatorSlug)}?item=${encodeURIComponent(listingId)}`;
  const [href, setHref] = useState(base);

  useEffect(() => {
    const { sid } = captureShareAttribution();
    if (sid) setHref(`${base}&sid=${sid}`);
  }, [base]);

  return (
    <TransitionLink
      href={href}
      className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-full py-4 text-sm font-bold transition-colors"
    >
      <ShoppingBag className="w-4 h-4" />
      Shop {curatorName}
      <ArrowRight className="w-3.5 h-3.5 opacity-60" />
    </TransitionLink>
  );
}
