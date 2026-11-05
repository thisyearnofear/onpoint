import type { Metadata } from "next";
import { getApiBase } from "@/lib/utils/api-base";
import { ScorePaddles } from "@/components/runway/ScorePaddles";
import { RunwayCtas } from "@/components/runway/RunwayCtas";
import { JudgePick } from "@/components/runway/JudgePick";
import type { StylistPersona } from "@repo/ai-client";
import { RUNWAY_SAMPLES } from "@/lib/runway-samples";

export const metadata: Metadata = {
  title: "Runway — a closet challenge | OnPoint",
  description:
    "Dress to the theme. You have 3 minutes. Raid your closet, send one photo, and a judge scores it.",
};

interface Today {
  theme: { id: string; name: string; brief: string };
  judges: Array<{ key: StylistPersona; name: string; sample: string }>;
  phoneNumber: string;
}

async function loadToday(): Promise<Today | null> {
  try {
    const res = await fetch(`${getApiBase()}/api/runway/today`, { next: { revalidate: 300 }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

const STEPS = [
  { n: "01", title: "Get a theme", copy: "A judge deals you one. The clock starts." },
  { n: "02", title: "Raid your closet", copy: "Real clothes, real mirror. No app to install." },
  { n: "03", title: "Face the judges", copy: "Three scores, one verdict, and the fix." },
];

export default async function RunwayPage() {
  const today = await loadToday();
  const themeId = today?.theme.id;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.18),transparent_65%)]" />

      <main className="relative mx-auto max-w-5xl px-4 pb-20 pt-16 md:pt-24">
        <div className="max-w-2xl">
          <h1 className="font-display text-4xl leading-[1.05] tracking-[-0.02em] sm:text-5xl md:text-6xl">
            Dress to the theme.
            <span className="block text-primary">You have 3 minutes.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Runway is a closet challenge: raid your own wardrobe, send one
            photo, and a judge scores it. Then we show you the piece that
            would have won.
          </p>
          <div className="mt-8">
            <RunwayCtas phoneNumber={today?.phoneNumber || "+16282646604"} themeId={themeId} />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Your photo is judged and discarded — never stored.
          </p>
        </div>

        {today && (
          <div className="mx-auto mt-14 max-w-md rounded-3xl border border-border bg-card/60 p-6 text-center">
            <p className="text-xs font-medium text-muted-foreground">
              Today&rsquo;s theme
            </p>
            <p className="mt-2 text-2xl font-black tracking-[-0.04em]">{today.theme.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{today.theme.brief}</p>
          </div>
        )}

        <div className="mt-14 grid gap-3 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl border border-border bg-card/60 p-5">
              <span className="font-mono text-xs font-bold tracking-[0.2em] text-primary">{s.n}</span>
              <h2 className="mt-4 text-lg font-bold">{s.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{s.copy}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 grid items-center gap-10 md:grid-cols-2">
          <div>
<h2 className="text-2xl font-black tracking-[-0.04em]">Pick who scores you.</h2>
            <div className="mt-5">
              <JudgePick judges={today?.judges || [{ key: "miranda", name: "Miranda" }, { key: "edina", name: "Edina" }, { key: "shaft", name: "Shaft" }]} themeId={themeId} />
            </div>
          </div>
          <div className="flex justify-center">
            <ScorePaddles scores={{ theme: 8, cohesion: 7, styling: 6 }} total={7.0} judgeName="Miranda" />
          </div>
        </div>
              <div className="mx-auto mt-16 max-w-2xl">
          <h2 className="text-lg font-bold">See it in action — no camera needed</h2>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {RUNWAY_SAMPLES.slice(0, 6).map((smp) => (
              <a
                key={smp.id}
                href={`/runway/play?sample=${smp.id}`}
                className="group overflow-hidden rounded-2xl border border-border bg-card/60 text-left transition-colors hover:border-primary/60"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={smp.src} alt={smp.label} className="aspect-[3/4] w-full object-cover" loading="lazy" />
                <span className="block px-2.5 py-2 text-xs font-bold text-foreground/80">{smp.label}</span>
              </a>
            ))}
          </div>
        </div>
</main>
    </div>
  );
}
