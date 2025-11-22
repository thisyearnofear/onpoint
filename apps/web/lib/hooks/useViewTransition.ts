'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

/**
 * useViewTransition Hook
 * 
 * Provides View Transitions API integration for Next.js navigation.
 * Enables smooth, coordinated animations between pages.
 * 
 * @example
 * ```tsx
 * const { push } = useViewTransition();
 * 
 * const handleNavigate = () => {
 *   push(`/item/${slug}`);
 * };
 * ```
 */
export function useViewTransition() {
  const router = useRouter();

  /**
   * Navigate with View Transitions
   * Falls back to regular navigation if API not supported
   */
  const push = useCallback(
    (href: string) => {
      // Check if View Transitions API is supported
      if (!('startViewTransition' in document)) {
        router.push(href);
        return;
      }

      (document.startViewTransition as any)?.(() => {
        router.push(href);
      });
    },
    [router]
  );

  const back = useCallback(() => {
    if (!('startViewTransition' in document)) {
      router.back();
      return;
    }

    (document.startViewTransition as any)?.(() => {
      router.back();
    });
  }, [router]);

  const forward = useCallback(() => {
    if (!('startViewTransition' in document)) {
      router.forward();
      return;
    }

    (document.startViewTransition as any)?.(() => {
      router.forward();
    });
  }, [router]);

  const replace = useCallback(
    (href: string) => {
      if (!('startViewTransition' in document)) {
        router.replace(href);
        return;
      }

      (document.startViewTransition as any)?.(() => {
        router.replace(href);
      });
    },
    [router]
  );

  return {
    push,
    back,
    forward,
    replace,
    supportsViewTransitions:
      typeof document !== 'undefined' && 'startViewTransition' in document,
  };
}

export default useViewTransition;
