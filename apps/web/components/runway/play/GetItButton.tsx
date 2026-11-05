import React from "react";
import { getItTarget } from "../../../lib/utils/get-it";

/**
 * The purchase verb on a Runway fix. Both the player's result card and the
 * shared `/runway/r/{id}` page render this, so the label can't drift from the
 * href. `fix.url` is used verbatim — the server already put sid, utm_source,
 * from, theme and judge on it.
 */
export function GetItButton({
  fix,
  className,
}: {
  fix: { kind?: string; title?: string; url?: string } | null | undefined;
  className?: string;
}) {
  const { label, href } = getItTarget(fix);
  return (
    <a
      href={href}
      aria-label={fix?.title ? `${label}: ${fix.title}` : label}
      className={
        className ??
        "mt-2 inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-bold text-white hover:bg-primary/90"
      }
    >
      {label}
    </a>
  );
}
