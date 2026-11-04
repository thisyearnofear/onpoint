"use client";

import { useState } from "react";
import { runwayPlayerId } from "../../../lib/utils/runway";
import { cardUrl } from "./types";
import type { DuelOutcome, OpponentState, ResultState, RoundState } from "./types";

type ShareChannel = "native" | "copy" | "download";

/** Challenge-link sharing (native file share → native share → clipboard) and story-card download. */
export function useRunwayShare(opts: {
  round: RoundState | null;
  result: ResultState | null;
  opponent: OpponentState | null;
  duel: DuelOutcome | null;
}) {
  const { round, result, opponent, duel } = opts;
  const [toast, setToast] = useState<string | null>(null);

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  };

  const recordShare = (channel: ShareChannel) => {
    if (!round) return;
    fetch(`/api/runway/rounds/${round.roundId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, playerId: runwayPlayerId() }),
    }).catch(() => undefined);
  };

  const share = async () => {
    if (!round || !result) return;
    const url = `${window.location.origin}/runway/r/${round.roundId}`;
    const text = opponent
      ? duel === "win"
        ? `I just beat a ${opponent.total.toFixed(1)} with a ${result.total.toFixed(1)} on ${round.theme.name}. Rematch?`
        : duel === "lose"
          ? `${result.total.toFixed(1)} vs their ${opponent.total.toFixed(1)} on ${round.theme.name}. Run it back — or take them on?`
          : `We tied at ${result.total.toFixed(1)} on ${round.theme.name}. Someone has to break this.`
      : `I got ${result.total.toFixed(1)} on ${round.theme.name}. Can you beat it?`;
    try {
      const res = await fetch(cardUrl(round.roundId, "story"));
      if (res.ok) {
        const blob = await res.blob();
        const file = new File([blob], "runway.png", { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], text, url });
          recordShare("native");
          return;
        }
      }
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return;
    }
    try {
      if (navigator.share) {
        await navigator.share({ title: "Runway", text, url });
        recordShare("native");
        return;
      }
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      recordShare("copy");
      flash("Challenge link copied");
    } catch {
      flash(url);
    }
  };

  const saveCard = () => {
    if (!round) return;
    const a = document.createElement("a");
    a.href = cardUrl(round.roundId, "story");
    a.download = `runway-${round.roundId}.png`;
    a.click();
    recordShare("download");
    flash("Story card saved");
  };

  return { toast, share, saveCard };
}
