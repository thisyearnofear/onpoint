import { Clock3, KeyRound, ReceiptText, Search } from "lucide-react";

const facts = [
  { icon: Search, value: "LIVE", label: "Prava UCP discovery" },
  { icon: ReceiptText, value: "$117.32", label: "captured binding quote" },
  { icon: KeyRound, value: "READY", label: "server-held credential" },
  { icon: Clock3, value: "HONEST", label: "unknown stays unknown" },
];

export function LiveCommerceProof() {
  return (
    <div className="border-t border-border/40 bg-background/75 backdrop-blur">
      <div className="container mx-auto grid max-w-6xl grid-cols-2 gap-px px-4 md:grid-cols-4">
        {facts.map(({ icon: Icon, value, label }) => (
          <div
            key={label}
            className="flex min-h-24 flex-col justify-center border-border/40 py-5 text-center odd:border-r md:border-r md:last:border-r-0"
          >
            <div className="mx-auto flex items-center gap-2 text-primary">
              <Icon className="h-4 w-4" />
              <span className="font-mono text-lg font-black tracking-tight sm:text-xl">
                {value}
              </span>
            </div>
            <span className="mt-1 text-[11px] text-muted-foreground sm:text-xs">
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
