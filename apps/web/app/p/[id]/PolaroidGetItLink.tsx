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
      className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-full py-4 text-sm font-bold shadow-lg shadow-indigo-500/20 transition-all"
    >
      <ShoppingBag className="w-4 h-4" />
      Shop {curatorName}
      <ArrowRight className="w-3.5 h-3.5 opacity-60" />
    </TransitionLink>
  );
}
