"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { SafeImage } from "../SafeImage";
import { FitGuess } from "./FitGuess";
import { nextCard } from "../../lib/pay/deck";
import type { Kept } from "../../lib/pay/kept";

/**
 * The three-card deck that fills the wait while a try-on develops:
 * call the fit, line up the next piece, look at what's already kept.
 * Staging is gentle — it nudges forward once when a card's job is done,
 * and idles through the cards at most one full cycle; any manual dot tap
 * ends the rotation for good. Fixed min-height so the layout never jumps.
 */
export function WaitDeck({
  guess,
  onGuess,
  pieces,
  queuedId,
  onQueue,
  kept,
}: {
  guess: number | null;
  onGuess: (n: number) => void;
  pieces: { id: string; title: string; urls: (string | null | undefined)[] }[];
  queuedId: string | null;
  onQueue: (id: string | null) => void;
  kept: Kept[];
}) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const manualRef = useRef(false);
  const cyclesRef = useRef(0);
  const lastInteractRef = useRef(0);
  const flagsRef = useRef({ guessLocked: false, queued: false });
  flagsRef.current = { guessLocked: guess != null, queued: queuedId != null };
  const nudged = useRef<{ guess?: boolean; queued?: boolean }>({});

  const advance = () => {
    const n = nextCard({
      current: indexRef.current,
      guessLocked: flagsRef.current.guessLocked,
      queued: flagsRef.current.queued,
      lastInteractionMs: lastInteractRef.current,
      now: Date.now(),
      cyclesDone: cyclesRef.current,
      manual: manualRef.current,
    });
    if (n != null && n !== indexRef.current) {
      if (n <= indexRef.current) cyclesRef.current += 1;
      indexRef.current = n;
      setIndex(n);
    }
  };

  // Nudges: a card's job is done → move it on once, after a short beat.
  const guessLocked = guess != null;
  const queued = queuedId != null;
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const nudge = (key: "guess" | "queued", on: boolean) => {
      if (!on || nudged.current[key]) return;
      nudged.current[key] = true;
      timers.push(setTimeout(advance, 900));
    };
    nudge("guess", guessLocked);
    nudge("queued", queued);
    return () => timers.forEach(clearTimeout);
  }, [guessLocked, queued]);

  // Idle rotation — every 9s, only if the deck has been left alone that
  // long, and at most one full lap of the three cards.
  useEffect(() => {
    const t = setInterval(advance, 9000);
    return () => clearInterval(t);
  }, []);

  const pick = (i: number) => {
    manualRef.current = true;
    indexRef.current = i;
    setIndex(i);
  };

  const queuedTitle = pieces.find((p) => p.id === queuedId)?.title;

  const cards = [
    // 1 — call it: a stake in the outcome while it develops
    <FitGuess key="guess" compact guess={guess} onPick={onGuess} />,
    // 2 — line up the next piece (queued, no request fired)
    <div key="pieces">
      <p className="text-sm font-semibold">Line up your next piece</p>
      <div className="mt-3 flex gap-2">
        {pieces.slice(0, 4).map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={queuedId === p.id}
            aria-label={p.title}
            title={p.title}
            onClick={() => onQueue(queuedId === p.id ? null : p.id)}
            className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted transition-all ${
              queuedId === p.id ? "ring-2 ring-foreground" : "opacity-70 hover:opacity-100"
            }`}
          >
            <SafeImage sources={p.urls} alt={p.title} fill className="object-cover" fallbackIconSize={20} />
          </button>
        ))}
      </div>
      {queuedId ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Next up: {queuedTitle}. One tap after this develops.
        </p>
      ) : null}
    </div>,
    // 3 — the mini history this device has already produced
    <div key="kept">
      {kept.length > 0 ? (
        <>
          <p className="text-sm font-semibold">Look #{kept.length + 1} on this device</p>
          <div className="mt-3 flex gap-3">
            {kept.slice(0, 4).map((k) => (
              <a
                key={k.id}
                href={k.webUrl}
                target="_blank"
                rel="noreferrer"
                className="block shrink-0 bg-white p-1 pb-0.5 shadow-sm transition-transform hover:-translate-y-0.5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={k.imageUrl} alt={k.item} className="h-14 w-12 object-cover" />
                <span className="block text-center text-[10px] leading-4 text-neutral-800">
                  {k.score != null ? `${k.score}/10` : " "}
                </span>
              </a>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="text-sm font-semibold">Your looks</p>
          <p className="mt-2 text-xs text-muted-foreground">
            This is your first look on this device. It&rsquo;ll be kept here when it lands.
          </p>
        </>
      )}
    </div>,
  ];

  return (
    <div onPointerDown={() => { lastInteractRef.current = Date.now(); }}>
      <div className="min-h-[150px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={index}
            initial={reduce ? false : { opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? undefined : { opacity: 0, x: -12 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            {cards[index]}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="flex gap-1" role="tablist" aria-label="While you wait">
        {[0, 1, 2].map((i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-current={index === i}
            aria-label={["Call it", "Line up the next one", "Your looks"][i]}
            onClick={() => pick(i)}
            className="flex h-11 w-7 items-center justify-center"
          >
            <span className={`h-1.5 w-1.5 rounded-full transition-colors ${index === i ? "bg-foreground" : "bg-foreground/25"}`} />
          </button>
        ))}
      </div>
    </div>
  );
}
