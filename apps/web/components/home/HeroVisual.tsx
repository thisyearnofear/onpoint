"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Shirt } from "lucide-react";
import { MuseSwap, museFor, clearMuse } from "./MuseSwap";
import product1 from "../../public/assets/1Product.png";
import model1 from "../../public/assets/1Model.png";
import product2 from "../../public/assets/2Product.png";
import model2 from "../../public/assets/2Model.png";
import product3 from "../../public/assets/3Product.png";
import model3 from "../../public/assets/3Model.png";

const looks = [
  {
    id: "graphic-01",
    product: product1,
    model: model1,
    label: "Graphic 01",
  },
  {
    id: "graphic-02",
    product: product2,
    model: model2,
    label: "Graphic 02",
  },
  {
    id: "graphic-03",
    product: product3,
    model: model3,
    label: "Graphic 03",
  },
];

export function HeroVisual() {
  const [selected, setSelected] = useState(0);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [muse, setMuse] = useState<string | null>(null);
  const [onScreen, setOnScreen] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const look = looks[selected]!;

  useEffect(() => setMuse(museFor(look.id)), [look.id]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setOnScreen(Boolean(entry?.isIntersecting)), { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const onVis = () => setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (reduceMotion || hasInteracted || !onScreen || !pageVisible) return;
    const timer = window.setInterval(
      () => setSelected((current) => (current + 1) % looks.length),
      3200,
    );
    return () => window.clearInterval(timer);
  }, [reduceMotion, hasInteracted, onScreen, pageVisible]);

  return (
    <div ref={rootRef} className="relative mx-auto w-full max-w-xl">
      <div className="absolute -inset-10 -z-10 bg-[radial-gradient(circle_at_55%_45%,hsl(var(--primary)/0.2),transparent_62%)] blur-2xl sm:blur-3xl" />

      <div className="overflow-hidden rounded-[2rem] border border-border/60 bg-[#111218] text-white shadow-2xl shadow-black/25">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-white/70">
              On-model demo
            </p>
            <p className="mt-1 text-sm font-semibold">Tap a garment</p>
          </div>
          <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider text-emerald-200">
            Interactive
          </span>
        </div>

        <div className="grid min-h-[430px] grid-cols-[5.25rem_1fr] sm:min-h-[480px] sm:grid-cols-[6.25rem_1fr]">
          <div className="z-20 flex flex-col justify-center gap-3 border-r border-white/10 bg-black/10 p-3">
            {looks.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSelected(index);
                  setHasInteracted(true);
                }}
                aria-label={`Dress model in ${item.label}`}
                aria-pressed={selected === index}
                className={`group relative aspect-square overflow-hidden rounded-2xl border bg-zinc-200 p-1.5 transition-all ${
                  selected === index
                    ? "border-white/60 shadow-lg ring-2 ring-white/30"
                    : "border-white/10 hover:border-white/30"
                }`}
              >
                <Image
                  src={item.product}
                  alt=""
                  fill
                  sizes="96px"
                  placeholder="blur"
                  className="object-contain p-2 transition-transform group-hover:scale-105"
                />
                {selected === index && (
                  <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-black">
                    <Check className="h-2.5 w-2.5" />
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="relative overflow-hidden bg-[radial-gradient(circle_at_50%_42%,rgba(255,255,255,0.13),transparent_54%)]">
            <div className="absolute inset-x-5 top-5 z-20 flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-[0.18em] text-white/70">
                {muse ? "Your muse · this device" : "Prepared model preview"}
              </span>
            </div>

            <AnimatePresence mode="popLayout">
              <motion.div
                key={look.id}
                initial={false}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-x-3 bottom-36 top-12"
              >
                {muse ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={muse}
                    alt="Your muse wearing the look"
                    className="h-full w-full object-contain object-bottom drop-shadow-[0_24px_40px_rgba(0,0,0,0.35)]"
                  />
                ) : (
                  <Image
                    src={look.model}
                    alt={`Model wearing ${look.label}`}
                    fill
                    priority
                    placeholder="blur"
                    sizes="(min-width: 1024px) 430px, 75vw"
                    className="object-contain object-bottom drop-shadow-[0_24px_40px_rgba(0,0,0,0.35)]"
                  />
                )}
              </motion.div>
            </AnimatePresence>

            <AnimatePresence>
              <motion.div
                key={`flight-${look.id}`}
                initial={
                  reduceMotion
                    ? false
                    : { x: -110, y: 30, opacity: 0.9, scale: 0.75, rotate: -8 }
                }
                animate={{ x: 80, y: 85, opacity: 0, scale: 0.25, rotate: 4 }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                className="pointer-events-none absolute left-0 top-1/3 z-30 h-24 w-24"
              >
                <Image
                  src={look.product}
                  alt=""
                  fill
                  sizes="96px"
                  placeholder="blur"
                  className="object-contain"
                />
              </motion.div>
            </AnimatePresence>

            <motion.div
              layout
              className="absolute inset-x-4 bottom-4 z-30 rounded-2xl border border-white/10 bg-black/65 p-3.5 shadow-xl backdrop-blur-xl"
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-fuchsia-300/10 text-fuchsia-200">
                    <Shirt className="h-4 w-4" />
                  </div>
                  <p className="text-xs font-semibold">Tap another garment</p>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 rounded-full border border-amber-200/20 bg-amber-200/10 px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide text-amber-100">
                    <Check className="h-3 w-3" /> On model
                  </div>
                  <span className="flex shrink-0 items-center gap-3">
                    {muse ? (
                      <button
                        type="button"
                        onClick={() => {
                          clearMuse(look.id);
                          setMuse(null);
                        }}
                        className="text-xs font-bold text-white/60 underline-offset-2 hover:underline"
                      >
                        Back to demo
                      </button>
                    ) : (
                      <MuseSwap
                        lookId={look.id}
                        garmentImageUrl={
                          typeof window !== "undefined"
                            ? `${window.location.origin}${look.product.src}`
                            : look.product.src
                        }
                        onDone={setMuse}
                      />
                    )}
                    <Link
                      href="/lab?tab=try-on&from=nia"
                      className="text-xs font-bold text-fuchsia-200 underline-offset-2 hover:underline"
                    >
                      Use my photo
                    </Link>
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <p className="mt-3 text-center font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
        Prepared previews. Try your own photo in the fitting room.
      </p>
    </div>
  );
}
