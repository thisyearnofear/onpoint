import Link from "next/link";
import type { SurfaceItem } from "./ItemRow";

/**
 * "More like this" rail — horizontal snap-scroll on mobile, four columns from
 * sm up. One source for the recommendation strip that was copied between /c
 * and /w.
 */
export function MoreRail({
  items,
  title = "More like this",
}: {
  items: SurfaceItem[];
  title?: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-10">
      <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
        {title}
      </p>
      <div className="-mx-4 mt-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 sm:pb-0">
        {items.map((item) => (
          <Link
            key={item.listingId}
            href={`/s/${item.curatorSlug}?item=${item.listingId}`}
            className="group w-36 shrink-0 snap-start border border-border bg-card transition-colors hover:border-foreground sm:w-auto"
          >
            {item.imageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={item.imageUrl}
                alt={item.title || "Item"}
                className="aspect-square w-full object-cover"
              />
            ) : (
              <div className="aspect-square w-full bg-muted" />
            )}
            <span className="block truncate border-t border-border px-3 py-2 text-xs font-bold text-foreground/80 group-hover:text-foreground">
              {item.title || "Item"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
