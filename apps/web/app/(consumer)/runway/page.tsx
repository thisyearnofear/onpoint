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

const EYEBROW = "font-mono text-xs font-bold uppercase tracking-[0.22em] text-primary";
const MUTED_EYEBROW = "font-mono text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground";

export default async function RunwayPage() {
  const today = await loadToday();
  const themeId = today?.theme.id;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-14 md:pt-20">
        <div className="grid items-start gap-10 lg:grid-cols-[3fr_2fr]">
          <div>
            <p className={EYEBROW}>A closet challenge · new theme daily</p>
            <h1 className="mt-3 font-display text-4xl leading-[1.05] tracking-[-0.02em] sm:text-5xl md:text-6xl">
              Dress to the theme.
              <span className="block text-primary">You have 3 minutes.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Runway is a closet challenge: raid your own wardrobe, send one
              photo, and a judge scores it. Then we show you the piece that
              would have won.
            </p>
            <div className="mt-8">
              <RunwayCtas phoneNumber={today?.phoneNumber} themeId={themeId} />
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Your photo is judged and discarded — never stored.
            </p>
          </div>

          <div className="border border-border bg-card p-6 lg:sticky lg:top-24">
            <p className={MUTED_EYEBROW}>Today&rsquo;s theme</p>
            {today ? (
              <>
                <p className="mt-3 font-display text-3xl tracking-[-0.02em]">{today.theme.name}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{today.theme.brief}</p>
              </>
            ) : (
              <>
                <p className="mt-3 font-display text-3xl tracking-[-0.02em]">Dealt at the door</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  The theme is revealed when your round starts — the clock is part of the game.
                </p>
              </>
            )}
            <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
              Three judges. Three scores. One verdict — and the fix.
            </p>
          </div>
        </div>

        <div className="mt-16 grid gap-3 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="border border-border bg-card p-5">
              <span className="font-mono text-xs font-bold tracking-[0.2em] text-primary">{s.n}</span>
              <h2 className="mt-4 text-lg font-bold">{s.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{s.copy}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 grid items-start gap-10 md:grid-cols-2">
          <div>
            <p className={EYEBROW}>The panel</p>
            <h2 className="mt-3 font-display text-3xl tracking-[-0.02em]">Pick who scores you.</h2>
            <div className="mt-6">
              <JudgePick judges={today?.judges || [{ key: "miranda", name: "Miranda" }, { key: "edina", name: "Edina" }, { key: "shaft", name: "Shaft" }]} themeId={themeId} />
            </div>
          </div>
          <div className="border border-border bg-card p-6 md:justify-self-center">
            <p className={MUTED_EYEBROW}>What a verdict looks like</p>
            <div className="mt-5 flex justify-center">
              <ScorePaddles scores={{ theme: 8, cohesion: 7, styling: 6 }} total={7.0} judgeName="Miranda" />
            </div>
          </div>
        </div>

        <div className="mt-16">
          <p className={EYEBROW}>No camera needed</p>
          <h2 className="mt-3 font-display text-3xl tracking-[-0.02em]">See it in action.</h2>
          <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-6">
            {RUNWAY_SAMPLES.slice(0, 6).map((smp) => (
              <a
                key={smp.id}
                href={`/runway/play?sample=${smp.id}`}
                className="group border border-border bg-card text-left transition-colors hover:border-foreground"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={smp.src} alt={smp.label} className="aspect-[3/4] w-full object-cover" loading="lazy" />
                <span className="block border-t border-border px-2.5 py-2 text-xs font-bold text-foreground/80 group-hover:text-foreground">{smp.label}</span>
              </a>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
