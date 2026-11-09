import Link from "next/link";

type ExitKind = "reply" | "couple" | "make" | "magazine" | "board" | "pair";

interface ExitDef {
  role: "primary" | "link";
  label: string;
  href: (id?: string) => string;
}

const EXITS: Record<ExitKind, ExitDef> = {
  reply: {
    role: "primary",
    label: "Send one back",
    href: (id) => `/couple${id ? `?reply=${encodeURIComponent(id)}` : ""}`,
  },
  couple: {
    role: "primary",
    label: "Make a card together",
    href: () => "/couple",
  },
  make: {
    role: "primary",
    label: "Make your own",
    href: () => "/couple",
  },
  magazine: {
    role: "link",
    label: "Or send it as a magazine →",
    href: () => "/magazine",
  },
  board: {
    role: "link",
    label: "Or see what others made →",
    href: () => "/cards",
  },
  pair: {
    role: "link",
    label: "Or try the same fit on someone →",
    href: () => "/pair",
  },
};

/**
 * The "next loop" exits at the foot of an artifact surface — one source for
 * the links that used to be copied three times. `id` is the artifact id when a
 * kind needs it (reply threads back to the card it answers).
 */
export function ExitLinks({
  kinds,
  id,
}: {
  kinds: ExitKind[];
  id?: string;
}) {
  const primaries = kinds.filter((k) => EXITS[k].role === "primary");
  const links = kinds.filter((k) => EXITS[k].role === "link");
  return (
    <div className="mt-10 border-t border-border pt-6 text-center">
      {primaries.map((k) => (
        <Link
          key={k}
          href={EXITS[k].href(id)}
          className="inline-flex min-h-12 items-center rounded-full bg-primary px-8 text-sm font-bold text-primary-foreground hover:bg-primary/90"
        >
          {EXITS[k].label}
        </Link>
      ))}
      {links.map((k) => (
        <Link
          key={k}
          href={EXITS[k].href(id)}
          className="mt-3 block text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {EXITS[k].label}
        </Link>
      ))}
    </div>
  );
}
