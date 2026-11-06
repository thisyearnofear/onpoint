import Link from "next/link";

/**
 * The bottom-of-guide action: one question, one pill into the fitting room.
 */
export function GuideCta({
  question,
  label,
  href = "/lab",
  icon,
}: {
  question: string;
  label: string;
  href?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="pt-6 text-center">
      <p className="mb-4 text-sm text-muted-foreground">{question}</p>
      <Link
        href={href}
        className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        {icon}
        {label}
      </Link>
    </div>
  );
}
