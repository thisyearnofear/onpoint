"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "onpoint_curator_slug";

/** True when this browser created or owns the curator storefront (localStorage). */
export function useCuratorOwner(curatorSlug: string): boolean {
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    try {
      setIsOwner(localStorage.getItem(STORAGE_KEY) === curatorSlug);
    } catch {
      setIsOwner(false);
    }
  }, [curatorSlug]);

  return isOwner;
}

export function markCuratorOwner(slug: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, slug);
  } catch {
    // ignore
  }
}
