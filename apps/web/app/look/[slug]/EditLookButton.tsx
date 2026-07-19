"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { useCuratorOwner } from "../../../lib/hooks/use-curator-owner";

interface EditLookButtonProps {
  curatorSlug: string | null;
  lookSlug: string;
}

/**
 * Renders an "Edit this look" button when the current browser
 * owns the curator storefront (localStorage check via useCuratorOwner).
 *
 * Links to the storefront page with ?editLook=slug, which the
 * CuratorOwnerTools component reads to open the CuratorLookCreator
 * in edit mode.
 */
export function EditLookButton({ curatorSlug, lookSlug }: EditLookButtonProps) {
  const isOwner = useCuratorOwner(curatorSlug || "");

  if (!isOwner || !curatorSlug) return null;

  return (
    <Link
      href={`/s/${curatorSlug}?editLook=${lookSlug}`}
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
    >
      <Pencil className="h-4 w-4" />
      Edit this look
    </Link>
  );
}
