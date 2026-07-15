"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { TransitionLink } from "../ViewTransition";

/**
 * A link button that gives immediate click feedback:
 * 1. Scales down on press (active state)
 * 2. Shows a spinner while the view transition / route loads
 * 3. Reverts after navigation completes or timeout
 *
 * Use for primary CTAs where the user needs to know "something is happening."
 */
export function FeedbackLink({
  href,
  children,
  className = "",
  onClick,
  spinnerClassName = "w-5 h-5",
  timeout = 2000,
  ...props
}: {
  href: string;
  children: ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  spinnerClassName?: string;
  timeout?: number;
} & Omit<React.ComponentProps<typeof TransitionLink>, "href" | "onClick" | "className" | "children">) {
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (
      e.defaultPrevented ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      e.button !== 0
    ) {
      return;
    }
    setLoading(true);
    // Safety: clear loading state after timeout in case navigation is instant
    // (same-page) or the view transition resolves faster than expected.
    timerRef.current = setTimeout(() => setLoading(false), timeout);
  };

  return (
    <TransitionLink
      href={href}
      onClick={handleClick}
      className={`relative transition-transform active:scale-95 ${
        loading ? "pointer-events-none opacity-80" : ""
      } ${className}`}
      {...props}
    >
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Loader2 className={`${spinnerClassName} animate-spin`} />
        </span>
      )}
      <span className={loading ? "invisible" : "flex items-center gap-2"}>
        {children}
      </span>
    </TransitionLink>
  );
}
