import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Swords } from "lucide-react";
import { getApiBase } from "../../../../lib/utils/api-base";
import { ScorePaddles } from "../../../../components/runway/ScorePaddles";
import { TextTheJudge } from "../../../../components/runway/TextTheJudge";
import { JudgeAvatar, judgeDisplayName } from "../../../../components/runway/JudgeAvatar";
import { SafeImage } from "../../../../components/SafeImage";

interface Result {
  roundId: string;
  themeId: string;
  themeName: string;
  persona: string;
  scores: { theme: number; cohesion: number; styling: number };
  total: number;
  verdict: string;
  fixHint: string;
  fix: { kind: string; title: string; imageUrl: string | null; url: string } | null;
  late: boolean;
  createdAt: number;
}

async function loadPhoneNumber(): Promise<string> {
  try {
    const res = await fetch(`${getApiBase()}/api/runway/today`, { next: { revalidate: 300 } });
    if (res.ok) return (await res.json()).phoneNumber;
  } catch {
    // fall through to the sandbox line
  }
  return "+16282646604";
}

async function loadResult(roundId: string): Promise<Result | null> {
  try {
    const res = await fetch(`${getApiBase()}/api/runway/results/${encodeURIComponent(roundId)}`, {
      next: { revalidate: 3600 },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to load result: ${res.status}`);
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ roundId: string }>;
}): Promise<Metadata> {
  const { roundId } = await params;
  const result = /^[a-f0-9]{12}$/.test(roundId) ? await loadResult(roundId) : null;
  if (!result) return { title: "Runway result | OnPoint" };
  return {
    title: `${result.total.toFixed(1)}/10 on ${result.themeName} — Runway`,
    description: result.verdict,
    openGraph: {
      images: [`${getApiBase()}/runway/card/${roundId}.png`],
    },
  };
}

export default async function RunwayResultPage({
  params,
}: {
  params: Promise<{ roundId: string }>;
}) {
  const { roundId } = await params;
  if (!/^[a-f0-9]{12}$/.test(roundId)) notFound();
  const result = await loadResult(roundId);
  if (!result) notFound();

  const judgeName = judgeDisplayName(result.persona);
  const phoneNumber = await loadPhoneNumber();

  return (
    <div className="dark min-h-screen bg-zinc-950 text-zinc-50">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.18),transparent_65%)]" />
      <main className="relative mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-8 px-4 py-16">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
          Runway · {result.themeName}
        </p>

        <ScorePaddles scores={result.scores} total={result.total} judgeName={judgeName} />

        <div className="flex w-full items-start gap-3">
          <JudgeAvatar persona={result.persona} size="md" />
          <div className="w-full rounded-2xl rounded-tl-sm border border-zinc-800 bg-zinc-900/80 px-4 py-3">
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-zinc-500">{judgeName}</p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-100">
              {result.late && <span className="mr-2 font-bold text-[hsl(var(--accent))]">LATE —</span>}
              {result.verdict}
            </p>
          </div>
        </div>

        {result.fix && (
          <div className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-primary">The fix</p>
            <div className="mt-2 flex items-center gap-4">
              {result.fix.imageUrl && (
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
                  <SafeImage sources={[result.fix.imageUrl]} alt={result.fix.title} fill unoptimized className="object-cover" fallbackIconSize={24} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm text-zinc-400">{result.fixHint}</p>
                <p className="truncate text-base font-bold text-zinc-50">{result.fix.title}</p>
                <a
                  href={result.fix.url}
                  className="mt-2 inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-bold text-white hover:bg-primary/90"
                >
                  See it on you
                </a>
              </div>
            </div>
          </div>
        )}

        <div className="text-center">
          <p className="text-2xl font-black tracking-[-0.04em]">
            Can you beat {result.total.toFixed(1)} on {result.themeName}?
          </p>
          <div className="mt-5 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href={`/runway/play?theme=${result.themeId}&judge=${result.persona}`}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-primary px-8 text-base font-bold text-white shadow-xl shadow-primary/20 transition-all hover:-translate-y-0.5 hover:bg-primary/90"
            >
              <Swords className="h-5 w-5" />
              Take the challenge
            </Link>
            <TextTheJudge phoneNumber={phoneNumber} body={`play ${result.themeId}`} />
          </div>
          <p className="mt-4 text-xs text-zinc-500">
            Your photo is judged and discarded — never stored.
          </p>
        </div>
      </main>
    </div>
  );
}
