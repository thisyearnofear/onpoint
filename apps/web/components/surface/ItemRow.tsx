import Link from "next/link";
import { storefrontDoor } from "../../lib/utils/get-it";
import { SaveItemButton } from "../SaveItemButton";

export interface SurfaceItem {
  listingId: string;
  curatorSlug: string | null;
  title: string | null;
  imageUrl: string | null;
}

function Thumb({ item }: { item: SurfaceItem }) {
  return item.imageUrl ? (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={item.imageUrl}
      alt={item.title || "Item"}
      className="h-14 w-14 shrink-0 border border-border object-cover"
    />
  ) : (
    <div className="h-14 w-14 shrink-0 border border-border bg-muted" />
  );
}

const TRY_ON =
  "inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90";
const GET_IT =
  "inline-flex min-h-11 items-center rounded-full border border-border px-4 text-xs font-bold text-foreground hover:border-foreground";

/**
 * The single item row — thumbnail + title + actions. Replaces the hand-copied
 * rows in /c, /w, /m, /gift and /try. One thumbnail size (56px), buttons at
 * 44px minimum. `from` names the shelf the garment came from for the fitting
 * room deep link (a curator slug when known, else the artifact kind).
 */
export function ItemRow({
  item,
  from,
  variant = "full",
}: {
  item: SurfaceItem;
  /** Fallback `from=` source when the item has no curator (reserved: card|list|mag). */
  from: string;
  /** full: thumb | title | Try/Get/Save · compact: thumb | title over Try/Get */
  variant?: "full" | "compact";
}) {
  const door = storefrontDoor(item);
  const tryOnHref = `/lab/try-on?from=${encodeURIComponent(item.curatorSlug || from)}&item=${encodeURIComponent(item.listingId)}`;

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-3 border border-border bg-card p-3">
        <Thumb item={item} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-foreground">
            {item.title || "The piece"}
          </p>
          <div className="mt-2 flex gap-2">
            <Link href={tryOnHref} className={`${TRY_ON} px-3`}>
              Try it on
            </Link>
            {item.curatorSlug && (
              <Link href={door.href} className={`${GET_IT} px-3`}>
                {door.label}
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 border border-border bg-card p-4">
      <div className="flex min-w-0 items-center gap-4">
        <Thumb item={item} />
        <p className="truncate text-sm font-bold text-foreground">
          {item.title || "The piece"}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Link href={tryOnHref} className={TRY_ON}>
          Try it on
        </Link>
        {item.curatorSlug && (
          <Link href={door.href} className={GET_IT}>
            {door.label}
          </Link>
        )}
        <SaveItemButton item={item} />
      </div>
    </div>
  );
}
