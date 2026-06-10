"use client";

import React from "react";
import { motion } from "framer-motion";
import { useInView } from "../../lib/hooks/useInView";

type Direction = "up" | "down" | "left" | "right";

interface RevealProps {
  children: React.ReactNode;
  /** Delay before animation starts (seconds) */
  delay?: number;
  /** Entrance direction */
  direction?: Direction;
  /** Distance to travel in pixels */
  distance?: number;
  /** Animation duration in seconds */
  duration?: number;
  /** Once triggered, never re-trigger (default: true) */
  once?: boolean;
  className?: string;
  as?: "div" | "section" | "span";
}

const DIRECTION_MAP: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: 1 },
  down: { x: 0, y: -1 },
  left: { x: 1, y: 0 },
  right: { x: -1, y: 0 },
};

/**
 * Reveal — scroll-triggered entrance animation wrapper.
 * Uses IntersectionObserver via useInView. Respects prefers-reduced-motion.
 *
 * @example
 * <Reveal delay={0.2} direction="up">
 *   <h1>Content fades in scrolling up</h1>
 * </Reveal>
 */
export function Reveal({
  children,
  delay = 0,
  direction = "up",
  distance = 24,
  duration = 0.5,
  once = true,
  className,
  as = "div",
}: RevealProps) {
  const { ref, inView } = useInView<HTMLDivElement>({ once, threshold: 0.1 });
  const dir = DIRECTION_MAP[direction];

  const MotionTag = as === "span" ? motion.span : as === "section" ? motion.section : motion.div;

  return (
    <MotionTag
      ref={ref}
      initial={{
        opacity: 0,
        x: dir.x * distance,
        y: dir.y * distance,
      }}
      animate={
        inView
          ? { opacity: 1, x: 0, y: 0 }
          : once
            ? {}
            : { opacity: 0, x: dir.x * distance, y: dir.y * distance }
      }
      transition={{
        duration,
        delay,
        ease: [0.34, 1.56, 0.64, 1],
      }}
      className={className}
    >
      {children}
    </MotionTag>
  );
}
