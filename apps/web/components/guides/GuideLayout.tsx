import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { OnPointLayout } from "../OnPointLayout";

/**
 * The one chrome for /guides/* — back link, mono eyebrow, font-display title,
 * lede, and a hairline takeaway list. Guide pages supply only their content.
 */
export function GuideLayout({
  title,
  lede,
  takeaways,
  children,
}: {
  title: string;
  lede: string;
  takeaways?: string[];
  children: React.ReactNode;
}) {
  return (
    <OnPointLayout footer={false}>
      <article className="mx-auto max-w-3xl px-4 py-10">
        <Link
          href="/guides"
          className="mb-8 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All guides
        </Link>

        <header className="mb-8">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-primary">
            Style guide
          </p>
          <h1 className="mt-3 font-display text-3xl leading-[1.05] tracking-[-0.02em] md:text-4xl">
            {title}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            {lede}
          </p>
        </header>

        {takeaways && takeaways.length > 0 && (
          <div className="mb-8 border border-border p-5">
            <h2 className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
              Quick takeaways
            </h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {takeaways.map((tip) => (
                <li key={tip} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {children}
      </article>
    </OnPointLayout>
  );
}
