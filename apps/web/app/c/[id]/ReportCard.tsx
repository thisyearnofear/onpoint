"use client";

import React, { useState } from "react";

/** The person in the photo never consented to the board — this is their exit.
 *  Link possession is the authority, same as the wishlist capability model. */
export function ReportCard({ id }: { id: string }) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const report = async () => {
    setBusy(true);
    try {
      await fetch(`/api/couple/card/${encodeURIComponent(id)}/report`, { method: "POST" });
    } catch {
      /* still show the settled state — retry costs nothing but a second click */
    }
    setDone(true);
  };

  if (done) {
    return (
      <p className="mt-3 text-xs text-muted-foreground">
        It&apos;s off the board — the link still works for whoever has it.
      </p>
    );
  }
  return (
    <button
      type="button"
      onClick={() => void report()}
      disabled={busy}
      className="mt-3 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
    >
      This is you? Take it off the board
    </button>
  );
}
