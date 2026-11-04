import type { StylistPersona } from "@repo/ai-client";

export type ScoreTier = "high" | "mid" | "low";

/** Unified score tiers: >=8 is a show-stopper, <4 gets roasted. */
export function scoreTier(total: number): ScoreTier {
  return total >= 8 ? "high" : total < 4 ? "low" : "mid";
}

// StylistPersona has more keys than the three runway judges — Partial keeps
// the map honest without inventing lines for personas that never judge.
const LINES: Partial<Record<StylistPersona, Record<ScoreTier, string[]>>> = {
  miranda: {
    high: [
      "Even I have to admit — that's how it's done.",
      "Well. Someone read the brief.",
      "Acceptable. Don't get comfortable.",
    ],
    mid: [
      "Adequate. Barely.",
      "Half a look is still half.",
      "It almost worked.",
    ],
    low: [
      "I've seen better at airport security.",
      "This is why we can't have nice themes.",
      "Next time, try the theme.",
    ],
  },
  edina: {
    high: [
      "FABULOUS, darling. Simply fabulous!",
      "I'm obsessed. Obsessed!",
      "This is everything, sweetie!",
    ],
    mid: [
      "Almost there, darling — one tweak!",
      "Cute! Cute-ish.",
      "Sweetie, the bones are there.",
    ],
    low: [
      "Oh honey. No.",
      "Darling, what were we going for?",
      "A brave choice. Very brave.",
    ],
  },
  shaft: {
    high: [
      "Clean. Respect.",
      "Now that's a fit.",
      "You came correct.",
    ],
    mid: [
      "Decent. Push it further.",
      "Halfway there, player.",
      "Not bad — finish the job.",
    ],
    low: [
      "We need to talk about that fit.",
      "Rough one, champ.",
      "The theme called — it wants its brief back.",
    ],
  },
};

/** Deterministic banter line for a reacting judge — same round always gets the same heckle. */
export function banterFor(judge: StylistPersona, tier: ScoreTier, seed: string): string {
  const pool = LINES[judge]?.[tier] ?? LINES.miranda![tier];
  let h = 0;
  const s = `${seed}:${judge}:${tier}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return pool[Math.abs(h) % pool.length]!;
}
