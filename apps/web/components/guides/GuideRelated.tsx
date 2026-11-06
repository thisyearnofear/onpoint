import Link from "next/link";

export interface GuideRelatedLink {
  href: string;
  title: string;
  desc: string;
}

/** The "Related guides" link list at the foot of a guide page. */
export function GuideRelated({ links }: { links: GuideRelatedLink[] }) {
  return (
    <div className="mt-8 border-t border-border pt-6">
      <h3 className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
        Related guides
      </h3>
      <div className="mb-4 mt-3 grid gap-3 sm:grid-cols-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group block border-b border-border/40 py-3 transition-colors hover:border-primary/30"
          >
            <p className="text-sm font-bold">{link.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{link.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
