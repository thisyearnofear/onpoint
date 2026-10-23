import Link from "next/link";
import { Swords } from "lucide-react";

export default function RunwayResultNotFound() {
  return (
    <div className="dark min-h-screen bg-zinc-950 text-zinc-50">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.18),transparent_65%)]" />
      <main className="relative mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-8 px-4 py-16 text-center">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
          Runway
        </p>
        <h1 className="text-3xl font-black tracking-[-0.04em]">
          This round has left the runway.
        </h1>
        <p className="max-w-sm text-sm leading-relaxed text-zinc-400">
          Result cards live for 30 days, then they walk off. Your turn — a
          judge deals you today&rsquo;s theme and you have 3 minutes to dress
          for it.
        </p>
        <Link
          href="/runway"
          className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-primary px-8 text-base font-bold text-white shadow-xl shadow-primary/20 transition-all hover:-translate-y-0.5 hover:bg-primary/90"
        >
          <Swords className="h-5 w-5" />
          Play today&rsquo;s theme
        </Link>
      </main>
    </div>
  );
}
