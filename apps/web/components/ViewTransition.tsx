"use client";

/**
 * View Transitions for App Router navigation — zero dependencies.
 *
 * Wraps client-side navigation in document.startViewTransition so elements
 * sharing a `view-transition-name` (e.g. a curator avatar on the directory
 * card and the storefront header) morph between pages instead of hard-cutting.
 *
 * Progressive enhancement: browsers without the API, and users with
 * prefers-reduced-motion, get plain instant navigation.
 *
 * The tricky part: router.push() resolves before the new route is rendered,
 * so the transition would snapshot a stale frame. We hold the transition's
 * update-callback promise open until the pathname actually changes
 * (resolved by ViewTransitionResolver in the provider via useLayoutEffect).
 */

import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  startTransition,
  useContext,
  useLayoutEffect,
  useRef,
  type ComponentProps,
  type MouseEvent,
} from "react";

type NavigateWithTransition = (href: string) => void;

const ViewTransitionContext = createContext<NavigateWithTransition | null>(null);

function supportsViewTransitions(): boolean {
  return (
    typeof document !== "undefined" &&
    "startViewTransition" in document &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Run a same-document DOM update inside a view transition when supported. */
export function withViewTransition(update: () => void): void {
  if (supportsViewTransitions()) {
    (document as Document & {
      startViewTransition: (cb: () => void) => unknown;
    }).startViewTransition(update);
  } else {
    update();
  }
}

export function ViewTransitionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const pendingResolve = useRef<(() => void) | null>(null);

  // The new route has committed — let the held transition snapshot it.
  useLayoutEffect(() => {
    pendingResolve.current?.();
    pendingResolve.current = null;
  }, [pathname]);

  const navigate: NavigateWithTransition = (href) => {
    if (!supportsViewTransitions()) {
      router.push(href);
      return;
    }
    (document as Document & {
      startViewTransition: (cb: () => Promise<void>) => unknown;
    }).startViewTransition(
      () =>
        new Promise<void>((resolve) => {
          pendingResolve.current = resolve;
          startTransition(() => router.push(href));
          // Safety valve: never hold the old frame longer than a beat if the
          // route is slow — degrade to a crossfade rather than a hang.
          setTimeout(resolve, 800);
        }),
    );
  };

  return (
    <ViewTransitionContext.Provider value={navigate}>
      {children}
    </ViewTransitionContext.Provider>
  );
}

type TransitionLinkProps = ComponentProps<typeof NextLink> & { href: string };

/** Drop-in next/link replacement that animates the navigation. */
export function TransitionLink({ href, onClick, ...props }: TransitionLinkProps) {
  const navigate = useContext(ViewTransitionContext);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (
      !navigate ||
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return; // plain <Link> behaviour (new tab, provider missing, …)
    }
    event.preventDefault();
    navigate(href);
  };

  return <NextLink href={href} onClick={handleClick} {...props} />;
}
