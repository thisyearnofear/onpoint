import { Check, Clock3, KeyRound, Lock, ShieldCheck } from "lucide-react";

const steps = [
  { icon: Check, label: "Live product", value: "Alo Yoga · $108.00" },
  { icon: ShieldCheck, label: "Binding quote", value: "$108.00 + $9.32 tax = $117.32" },
  { icon: KeyRound, label: "Prava result", value: "Creds_Generated · credential_ready" },
  { icon: Lock, label: "Credential", value: "Retained server-side" },
  { icon: Clock3, label: "Merchant outcome", value: "Unknown timeout · not retried" },
];

export function PravaEvidenceReceipt() {
  return (
    <aside className="mt-8 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm" aria-labelledby="prava-proof-title">
      <div className="flex flex-col gap-2 border-b border-border/50 bg-muted/20 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Captured sandbox proof</p>
          <h3 id="prava-proof-title" className="mt-1 text-lg font-bold text-foreground">One permission. One credential. No invented outcome.</h3>
        </div>
        <p className="text-xs text-muted-foreground">Prava record · ord_01KZ…ZT1P</p>
      </div>
      <div className="divide-y divide-border/40 px-5">
        {steps.map(({ icon: Icon, label, value }) => (
          <div key={label} className="grid gap-1 py-3 text-sm sm:grid-cols-[1fr_1.7fr] sm:items-center">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
              {label}
            </span>
            <span className="font-medium text-foreground sm:text-right">{value}</span>
          </div>
        ))}
      </div>
      <p className="border-t border-border/50 px-5 py-3 text-xs leading-relaxed text-muted-foreground">
        Historical evidence from the validated Prava sandbox run. No Alo Yoga order, merchant approval, decline, or charge is claimed.
      </p>
    </aside>
  );
}
