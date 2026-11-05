"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Minimal modal accessibility: focus-in on open, Escape-to-close, Tab focus
 * trap, and focus restore to the previously focused element on close.
 * Attach the returned ref to the element carrying role="dialog".
 * onClose is held in a ref — callers may pass unstable closures.
 */
export function useModalA11y<T extends HTMLElement = HTMLDivElement>(
  isOpen: boolean,
  onClose: () => void,
) {
  const ref = useRef<T>(null);
  const onCloseRef = useRef(onClose);
  const restoreRef = useRef<Element | null>(null);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    restoreRef.current = document.activeElement;
    const el = ref.current;
    if (!el) return;

    (el.querySelector<HTMLElement>(FOCUSABLE) ?? el).focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = el.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (nodes.length === 0) {
        e.preventDefault();
        return;
      }
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey ? active === first || !el.contains(active) : active === last || !el.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    };

    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      (restoreRef.current as HTMLElement | null)?.focus?.();
    };
  }, [isOpen]);

  return ref;
}
