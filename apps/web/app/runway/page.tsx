import type { Metadata } from "next";
import { getApiBase } from "../../lib/utils/api-base";
import { ScorePaddles } from "../../components/runway/ScorePaddles";
import { RunwayCtas } from "../../components/runway/RunwayCtas";
import { JudgePick } from "../../components/runway/JudgePick";
import type { StylistPersona } from "@repo/ai-client";

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
    const res = await fetch(`${getApiBase()}/api/runway/today`, { next: { revalidate: 300 } });
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
    <div className="dark min-h-screen bg-zinc-950 text-zinc-50">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.18),transparent_65%)]" />

      <main className="relative mx-auto max-w-4xl px-4 pb-20 pt-16 md:pt-24">
        <div className="text-center">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
            Runway · A closet challenge
          </p>
          <h1 className="mt-4 text-4xl font-black leading-[1.02] tracking-[-0.04em] sm:text-5xl md:text-6xl">
            Dress to the theme.
            <span className="block text-primary">You have 3 minutes.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg">
            Raid your own closet, send one photo, and a judge scores it. Then we
            show you the piece that would have won.
          </p>
          <div className="mt-8">
            <RunwayCtas phoneNumber={today?.phoneNumber || "+14243945528"} themeId={themeId} />
          </div>
          <p className="mt-4 text-xs text-zinc-500">
            Your photo is judged and discarded — never stored.
          </p>
        </div>

        {today && (
          <div className="mx-auto mt-14 max-w-md rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 text-center">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
              Today&rsquo;s theme
            </p>
            <p className="mt-2 text-2xl font-black tracking-[-0.04em]">{today.theme.name}</p>
            <p className="mt-1 text-sm text-zinc-400">{today.theme.brief}</p>
          </div>
        )}

        <div className="mt-14 grid gap-3 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
              <span className="font-mono text-[9px] font-bold tracking-[0.2em] text-primary">{s.n}</span>
              <h2 className="mt-4 text-lg font-bold">{s.title}</h2>
              <p className="mt-1 text-sm text-zinc-400">{s.copy}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 grid items-center gap-10 md:grid-cols-2">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
              The judges
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-[-0.04em]">Pick who scores you.</h2>
            <div className="mt-5">
              <JudgePick judges={today?.judges || [{ key: "miranda", name: "Miranda" }, { key: "edina", name: "Edina" }, { key: "shaft", name: "Shaft" }]} themeId={themeId} />
            </div>
          </div>
          <div className="flex justify-center">
            <ScorePaddles scores={{ theme: 8, cohesion: 7, styling: 6 }} total={7.0} judgeName="Miranda" />
          </div>
        </div>
      </main>
    </div>
  );
}
