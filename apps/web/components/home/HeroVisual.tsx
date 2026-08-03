"use client";

import { motion } from "framer-motion";
import {
  Check,
  Clock3,
  KeyRound,
  Lock,
  ScanFace,
  Search,
  ShieldCheck,
} from "lucide-react";

const stages = [
  {
    icon: Search,
    label: "PRODUCT",
    title: "Alo Yoga · Airlift legging",
    detail: "$108.00 · live UCP inventory",
    tone: "text-sky-300 bg-sky-400/10 border-sky-300/20",
  },
  {
    icon: ScanFace,
    label: "FIT",
    title: "Try-on checked",
    detail: "Permission remains locked until this decision",
    tone: "text-fuchsia-300 bg-fuchsia-400/10 border-fuchsia-300/20",
  },
  {
    icon: ShieldCheck,
    label: "PERMISSION",
    title: "$117.32 ceiling · Alo only",
    detail: "$108.00 item · $0 shipping · $9.32 tax",
    tone: "text-amber-200 bg-amber-300/10 border-amber-200/20",
  },
  {
    icon: Clock3,
    label: "OUTCOME",
    title: "Credential ready · merchant unknown",
    detail: "Stopped safely · no retry · no invented result",
    tone: "text-orange-200 bg-orange-300/10 border-orange-200/20",
  },
];

export function HeroVisual() {
  return (
    <div className="relative mx-auto max-w-xl">
      <div className="absolute -inset-8 -z-10 bg-[radial-gradient(circle_at_55%_45%,hsl(var(--primary)/0.18),transparent_62%)] blur-2xl" />
      <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#111218] text-white shadow-2xl shadow-black/25">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/45">
              OnPoint commerce run
            </p>
            <p className="mt-1 text-sm font-semibold">Permission ledger</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
            </span>
            <span className="font-mono text-[10px] font-bold tracking-wider text-emerald-200">
              LIVE UCP
            </span>
          </div>
        </div>

        <div className="relative p-4 sm:p-5">
          <div className="absolute bottom-10 left-[2.15rem] top-10 w-px bg-gradient-to-b from-sky-300/50 via-amber-200/40 to-orange-200/20" />
          <div className="space-y-2.5">
            {stages.map(({ icon: Icon, label, title, detail, tone }, index) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, delay: 0.16 + index * 0.12 }}
                className="relative grid grid-cols-[2.5rem_1fr] gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3.5"
              >
                <div
                  className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-xl border ${tone}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-mono text-[9px] font-bold tracking-[0.2em] text-white/40">
                    {label}
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-tight text-white/95">
                    {title}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-white/48">
                    {detail}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px border-t border-white/10 bg-white/10">
          <div className="bg-[#111218] px-5 py-4">
            <div className="flex items-center gap-2 text-white/45">
              <KeyRound className="h-3.5 w-3.5" />
              <span className="font-mono text-[9px] tracking-wider">PRAVA</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-200">
              <Check className="h-3.5 w-3.5" /> Creds_Generated
            </div>
          </div>
          <div className="bg-[#111218] px-5 py-4">
            <div className="flex items-center gap-2 text-white/45">
              <Lock className="h-3.5 w-3.5" />
              <span className="font-mono text-[9px] tracking-wider">
                CREDENTIAL
              </span>
            </div>
            <p className="mt-2 text-xs font-semibold text-white/80">
              Server-held · single use
            </p>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
        Captured sandbox values · no merchant order claimed
      </p>
    </div>
  );
}
