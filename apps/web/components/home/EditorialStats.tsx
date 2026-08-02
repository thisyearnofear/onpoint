"use client";

import { useAnalysisHistory } from "../../lib/stores/analysis-history-store";
import { Reveal } from "../ui/Reveal";

export function EditorialStats() {
  const sessions = useAnalysisHistory((state) => state.sessions);
  const totalLooks = sessions.length;
  const avgScore = totalLooks > 0 ? (sessions.reduce((sum, s) => sum + s.score, 0) / totalLooks).toFixed(1) : null;
  const bestScore = totalLooks > 0 ? Math.max(...sessions.map((s) => s.score)) : null;

  // When the user has session history, show their real stats.
  // When they don't, show honest architectural facts — not fabricated metrics.
  const stats = totalLooks > 0
    ? [
        { value: String(totalLooks), label: "looks you've analyzed", suffix: "", prefix: "" },
        { value: avgScore!, label: "your avg. score", suffix: "/10", prefix: "" },
        { value: String(bestScore), label: "your best score", suffix: "/10", prefix: "" },
        { value: "0.03", label: "try-on fee (agents)", suffix: "", prefix: "$" },
      ]
    : [
        { value: "8", label: "digital designs to try", suffix: "", prefix: "" },
        { value: "0.03", label: "agent try-on fee", suffix: "", prefix: "$" },
        { value: "95/5", label: "curator payout split", suffix: "", prefix: "" },
        { value: "2.5%", label: "referral commission", suffix: "", prefix: "" },
      ];

  return (
    <section className="bg-[radial-gradient(ellipse_at_bottom,hsl(var(--primary)/0.05),transparent_60%)]">
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            {stats.map((stat, i) => (
              <Reveal key={stat.label} delay={i * 0.08}>
                <div className="text-center md:text-left">
                  <div className="text-4xl md:text-5xl font-black tracking-tighter text-foreground">
                    {stat.prefix}{stat.value}
                    {stat.suffix && <span className="text-primary">{stat.suffix}</span>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
