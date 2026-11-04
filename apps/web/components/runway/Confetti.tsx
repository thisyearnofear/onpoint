"use client";

import React, { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

const PALETTES = {
  accent: ["#ff5c8a", "#ffd166", "#7ae2c3", "#a78bfa", "#f4f4f5"],
  gold: ["#ffd166", "#f9c74f", "#fff3c4", "#e9c46a", "#f4f4f5"],
} as const;

/** One-shot ~90-particle burst from just above centre. Respects reduced motion. */
export function Confetti({ fire, variant = "accent" }: { fire: boolean; variant?: keyof typeof PALETTES }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!fire || reduce) return;
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.scale(dpr, dpr);

    const ox = window.innerWidth / 2;
    const oy = window.innerHeight * 0.38;
    const parts = Array.from({ length: 90 }, () => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
      const speed = 4 + Math.random() * 7;
      return {
        x: ox,
        y: oy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        w: 4 + Math.random() * 5,
        h: 3 + Math.random() * 4,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        color: PALETTES[variant][Math.floor(Math.random() * PALETTES[variant].length)] ?? "#f4f4f5",
        born: performance.now() + Math.random() * 120,
      };
    });

    let raf = 0;
    const DUR = 1700;
    const tick = (t: number) => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      let alive = false;
      for (const p of parts) {
        const age = t - p.born;
        if (age < 0) { alive = true; continue; }
        if (age > DUR) continue;
        alive = true;
        const dt = Math.min(age, 50) / 16.7;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 0.18 * dt;
        p.rot += p.vr * dt;
        ctx.save();
        ctx.globalAlpha = 1 - age / DUR;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (alive) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fire, reduce, variant]);

  if (!fire) return null;
  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-40 h-full w-full" />;
}
