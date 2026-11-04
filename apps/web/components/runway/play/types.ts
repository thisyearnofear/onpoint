import type { StylistPersona } from "@repo/ai-client";

export type Stage = "intro" | "round" | "preview" | "judging" | "result" | "capped" | "error";

export interface RoundState {
  roundId: string;
  deadline: number;
  theme: { id: string; name: string; brief: string };
  persona: { key: string; name: string };
  messages: string[];
}

export interface ResultState {
  scores: { theme: number; cohesion: number; styling: number };
  total: number;
  verdict: string;
  fixHint: string;
  late: boolean;
  fix?: { kind: string; title: string; imageUrl: string | null; url: string } | null;
}

/** The score being challenged, loaded from ?ref=<roundId> (a shared result). */
export interface OpponentState {
  roundId: string;
  total: number;
  themeId: string;
  themeName: string;
  persona: string;
  verdict: string;
}

export type DuelOutcome = "win" | "lose" | "tie";

export const JUDGE_LINES: Record<"miranda" | "edina" | "shaft", string[]> = {
  miranda: ["Interesting choice. We'll see.", "Hm. I wasn't expecting that.", "Hold still — I'm looking.", "This had better be good."],
  edina: ["Darling, show me everything.", "Ooh, I do love a surprise.", "Sweetie, the suspense!", "Don't keep me waiting."],
  shaft: ["Let's see what you brought.", "Confidence. I respect it.", "Alright — impress me.", "Time to deliver."],
};

export const REF_RE = /^[a-f0-9]{12}$/;
export const MIN_JUDGE_MS = 2400;

export const JUDGES: Array<{ key: StylistPersona; name: string }> = [
  { key: "miranda", name: "Miranda" },
  { key: "edina", name: "Edina" },
  { key: "shaft", name: "Shaft" },
];

export const cardUrl = (roundId: string | undefined, format: "story" | "feed") =>
  `/runway/card/${roundId}.png?format=${format}`;
