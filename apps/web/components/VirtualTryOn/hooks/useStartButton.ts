"use client";

import { useState, useCallback, useEffect, useRef } from "react";

/**
 * useStartButton — encapsulates the "click → spinner → delayed onStart" flow
 * used by the Live Style Camera start button. Exposed as a hook so it can be
 * unit-tested independently of the full start screen component.
 *
 * Behaviour:
 *  - On click: flips isStarting=true immediately and schedules onStart after
 *    a short delay (so the spinner is visible before the start screen unmounts).
 *  - Resets isStarting when isInitializing goes false (e.g. user cancelled
 *    via the init overlay and we return to the start screen).
 *  - Ignores subsequent clicks while already starting or initializing — uses
 *    a ref to guard against stale-closure double-clicks within a single render.
 */
export function useStartButton(
  onStart: () => void,
  isInitializing: boolean,
  delayMs: number = 200,
) {
  const [isStarting, setIsStarting] = useState(false);
  const isStartingRef = useRef(false);
  const isInitializingRef = useRef(isInitializing);
  isInitializingRef.current = isInitializing;

  const handleStart = useCallback(() => {
    if (isStartingRef.current || isInitializingRef.current) return;
    isStartingRef.current = true;
    setIsStarting(true);
    if (typeof window !== "undefined") {
      window.setTimeout(() => onStart(), delayMs);
    } else {
      onStart();
    }
  }, [onStart, delayMs]);

  useEffect(() => {
    if (!isInitializing) {
      isStartingRef.current = false;
      setIsStarting(false);
    }
  }, [isInitializing]);

  return {
    isStarting,
    showSpinner: isStarting || isInitializing,
    handleStart,
  };
}
