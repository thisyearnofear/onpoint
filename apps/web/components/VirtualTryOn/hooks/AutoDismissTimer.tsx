"use client";

import { useEffect, useRef } from "react";

/**
 * AutoDismissTimer — invisible component that fires `onDismiss` after `ms`
 * milliseconds. Uses a ref to stash the latest callback so the timer is not
 * reset every time the parent re-renders with a new inline callback.
 *
 * Exported as a standalone component so it can be unit-tested and reused.
 */
export function AutoDismissTimer({
  ms,
  onDismiss,
}: {
  ms: number;
  onDismiss: () => void;
}) {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  useEffect(() => {
    const timer = setTimeout(() => onDismissRef.current(), ms);
    return () => clearTimeout(timer);
  }, [ms]);
  return null;
}
