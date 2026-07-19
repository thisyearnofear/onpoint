"use client";

import Link from "next/link";
import { Bookmark, ArrowRight, Camera, Sparkles } from "lucide-react";
import { Reveal } from "../ui/Reveal";
import { SafeImage } from "../SafeImage";
import { useAnalysisHistory } from "../../lib/stores/analysis-history-store";
import { trackRecentlySavedClicked } from "../../lib/utils/analytics";

export function RecentlySavedSection() {
  const sessions = useAnalysisHistory((state) => state.sessions);
  const recent = sessions.slice(0, 3);

  if (recent.length === 0) return null;

  return (
    <section className="bg-[radial-gradient(ellipse_at_center,hsl(var(--accent)/0.04),transparent_70%)] overflow-hidden">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <Reveal className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-medium mb-1">
                <Bookmark className="h-3.5 w-3.5" />
                Continued from last visit
              </div>
              <h2 className="text-xl font-bold tracking-tight md:text-2xl">
                Recently Saved
              </h2>
            </div>
            <Link
              href="/lab"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 active:opacity-70 active:scale-[0.98] transition-[opacity,transform,color]"
            >
              New look
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Film strip — overlapping images, no card containers */}
          <div className="flex -space-x-4 sm:-space-x-6 md:-space-x-8">
            {recent.map((session, i) => {
              const date = new Date(session.createdAt);
              const dateLabel = date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              });
              return (
                <Link
                  key={session.id}
                  href="/lab?tab=my-looks"
                  onClick={() =>
                    trackRecentlySavedClicked({
                      sessionAge: (Date.now() - new Date(session.createdAt).getTime()) / 3600000,
                      score: session.score,
                      persona: session.persona,
                    })
                  }
                  className="group relative flex-1 aspect-[4/3] overflow-hidden rounded-lg transition-all duration-300 hover:z-10 hover:scale-[1.02] hover:shadow-2xl"
                  style={{ minWidth: 0 }}
                >
                  {session.coverImage ? (
                    <SafeImage
                      sources={[session.coverImage]}
                      alt={session.headline}
                      fill
                      unoptimized
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted">
                      <Camera className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                  )}
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  {/* Score badge */}
                  <div className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-xs font-bold text-white backdrop-blur-sm">
                    <Sparkles className="h-3 w-3 text-amber-400" />
                    {session.score}/10
                  </div>
                  {/* Info overlay — visible on hover */}
                  <div className="absolute inset-x-0 bottom-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                    <p className="text-xs font-semibold leading-snug text-white line-clamp-1 drop-shadow-lg">
                      {session.headline}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[10px] text-white/70">{dateLabel}</span>
                      {session.persona && (
                        <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[11px] font-medium text-white capitalize">
                          {session.persona}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
