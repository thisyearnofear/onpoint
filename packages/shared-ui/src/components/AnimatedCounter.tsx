'use client';

import React, { useEffect, useState } from 'react';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  delay?: number;
  decimals?: number;
  formatter?: (value: number) => string;
  animated?: boolean;
  className?: string;
}

const STEPS = 30;

export function AnimatedCounter({
  value: target,
  duration = 1500,
  delay = 0,
  decimals = 0,
  formatter,
  animated = true,
  className,
}: AnimatedCounterProps) {
  const [display, setDisplay] = useState(animated ? 0 : target);

  useEffect(() => {
    if (!animated) {
      setDisplay(target);
      return;
    }

    const timeout = setTimeout(() => {
      const stepDuration = duration / STEPS;
      const increment = target / STEPS;
      let step = 0;

      const interval = setInterval(() => {
        step++;
        const factor = Math.pow(10, decimals);
        const current = Math.min(
          Math.round(increment * step * factor) / factor,
          target,
        );
        setDisplay(current);

        if (step >= STEPS) {
          clearInterval(interval);
          setDisplay(target);
        }
      }, stepDuration);

      return () => clearInterval(interval);
    }, delay * 1000);

    return () => clearTimeout(timeout);
  }, [target, duration, delay, decimals, animated]);

  const rendered = formatter ? formatter(display) : display.toFixed(decimals);

  return <span className={className}>{rendered}</span>;
}
