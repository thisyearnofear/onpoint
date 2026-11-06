/**
 * One vertical rhythm + one heading style for brochure surfaces
 * (/curator, /about, /developers, /guides). Replaces the per-page
 * py-16 md:py-20 × font-black pattern.
 */
export function Section({
  eyebrow,
  title,
  children,
  className = "",
  id,
}: {
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`py-10 md:py-16 ${className}`}>
      <div className="mx-auto w-full max-w-4xl px-4">
        {eyebrow && (
          <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-primary">
            {eyebrow}
          </p>
        )}
        {title && (
          <h2 className="mt-3 font-display text-2xl leading-tight tracking-[-0.01em] sm:text-3xl">
            {title}
          </h2>
        )}
        {children && <div className={title || eyebrow ? "mt-6" : undefined}>{children}</div>}
      </div>
    </section>
  );
}
