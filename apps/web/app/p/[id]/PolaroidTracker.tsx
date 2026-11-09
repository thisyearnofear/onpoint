"use client";

import { useEffect } from "react";
import {
  captureShareAttribution,
  getShareAttribution,
} from "@/lib/utils/share-attribution";

const STORAGE_KEY = "onpoint_share";

/**
 * Arrival half of the polaroid share loop. A visitor landing on /p/{id}?sid=…
 * gets their sid captured (same helper every surface uses), bound to a
 * synthetic `p-<id>` look key when no real look is known — that key is what
 * getAttributionFields() sends as lookSlug on try-on/order calls, so the
 * artifact's shares join the funnel instead of dead-ending at the page.
 * Then it reports the visit so share → visit is measurable.
 */
export function PolaroidTracker({ polaroidId }: { polaroidId: string }) {
  useEffect(() => {
    const attribution = captureShareAttribution();
    if (!attribution.sid) return;

    // Bind the sid to this artifact unless a real look already claimed it.
    const look = `p-${polaroidId}`.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 120);
    const current = getShareAttribution();
    if (current.sid === attribution.sid && !current.look) {
      try {
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ sid: attribution.sid, channel: attribution.channel, look }),
        );
      } catch {
        /* storage may be blocked */
      }
    }

    void fetch("/api/loop/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "artifact_visit",
        meta: {
          shareId: attribution.sid,
          channel: attribution.channel,
          lookSlug: look,
          path: `/p/${polaroidId}`,
        },
      }),
      keepalive: true,
    }).catch(() => {});
  }, [polaroidId]);

  return null;
}
