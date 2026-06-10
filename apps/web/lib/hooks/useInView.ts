"use client";

import { useEffect, useRef, useState } from "react";

interface UseInViewOptions extends IntersectionObserverInit {
  /** Fire only once, then disconnect (default: true) */
  once?: boolean;
}

/**
 * useInView — one-shot IntersectionObserver hook for scroll-triggered animations.
 *
 * @example
 * const { ref, inView } = useInView({ threshold: 0.2 });
 * return <motion.div ref={ref} animate={inView ? { opacity: 1 } : {}} />;
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(
  options?: UseInViewOptions,
) {
  const { once = true, ...observerOptions } = options ?? {};
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || (once && inView)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { threshold: 0.1, ...observerOptions },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [once, inView]);

  return { ref, inView };
}
