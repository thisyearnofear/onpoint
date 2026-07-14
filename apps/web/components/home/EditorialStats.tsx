"use client";

import { useAnalysisHistory } from "../../lib/stores/analysis-history-store";
import { Reveal } from "../ui/Reveal";

export function EditorialStats() {
  const sessions = useAnalysisHistory((state) => state.sessions);
  const totalLooks = sessions.length;
  const avgScore = totalLooks > 0 ? (sessions.reduce((sum, s) => sum + s.score, 0) / totalLooks).toFixed(1) : null;
  const bestScore = totalLooks > 0 ? Math.max(...sessions.map((s) => s.score)) : null;

  const stats = [
    { value: "6", label: "AI stylists", suffix: "" },
    { value: avgScore || "8", label: "avg. score", suffix: "/10" },
    { value: totalLooks > 0 ? String(totalLooks) : "30", label: totalLooks > 0 ? "looks you've analyzed" : "seconds to first result", suffix: "" },
    { value: bestScore ? String(bestScore) : "0", label: totalLooks > 0 ? "your best score" : "platform fees", suffix: totalLooks > 0 ? "/10" : "", prefix: totalLooks > 0 ? "" : "$" },
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
                    {"prefix" in stat && stat.prefix}{stat.value}
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
