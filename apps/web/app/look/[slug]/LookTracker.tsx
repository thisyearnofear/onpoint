"use client";

import { useEffect } from "react";
import {
  captureShareAttribution,
  postLookEvent,
} from "../../../lib/utils/share-attribution";

/**
 * Renders nothing. On mount reports a look visit (with the share id, if the
 * visitor arrived via a share link) and reports clicks on elements marked
 * `data-look-cta="tryon|shop"` via event delegation.
 */
export function LookTracker({ lookSlug }: { lookSlug: string }) {
  useEffect(() => {
    const attribution = captureShareAttribution();

    const visitKey = `onpoint_look_visit_${lookSlug}`;
    let alreadyCounted = false;
    try {
      alreadyCounted = sessionStorage.getItem(visitKey) === "1";
      if (!alreadyCounted) sessionStorage.setItem(visitKey, "1");
    } catch {
      /* ignore */
    }
    if (!alreadyCounted) {
      postLookEvent(lookSlug, "visit", {
        shareId: attribution.sid,
        channel: attribution.channel,
      });
    }

    function onClick(e: MouseEvent) {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(
        "[data-look-cta]",
      );
      const kind = el?.dataset.lookCta;
      if (kind !== "tryon" && kind !== "shop") return;
      postLookEvent(lookSlug, "cta", {
        kind,
        shareId: attribution.sid,
        channel: attribution.channel,
      });
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [lookSlug]);

  return null;
}
