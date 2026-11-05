"use client";

import { useEffect } from "react";
import { captureShareAttribution } from "@/lib/utils/share-attribution";

/**
 * Mount on an artifact page (`/c/{id}`, `/w/{id}`, `/m/{id}`, `/p/{id}`) that is
 * itself server-rendered and so can't rewrite its own outbound links. Storing
 * the inbound `?sid=` here is what carries the share through to the storefront
 * and the order, which read it back from the session.
 */
export function ShareAttributionCapture() {
  useEffect(() => {
    captureShareAttribution();
  }, []);
  return null;
}
