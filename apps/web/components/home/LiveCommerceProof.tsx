"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Box, Store, Zap } from "lucide-react";
import { getApiBase } from "../../lib/utils/api-base";

type DirectoryMeta = {
  activeStorefronts?: number;
  agentPurchasableCount?: number;
};

type DirectoryResponse = {
  curators?: Array<{ liveListingCount?: number }>;
  meta?: DirectoryMeta;
};

export function LiveCommerceProof() {
  const [data, setData] = useState<DirectoryResponse | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${getApiBase()}/api/curator/directory?agentPurchasable=1`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => setData(payload))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const agentReady = data?.meta?.agentPurchasableCount;
  const storefronts = data?.meta?.activeStorefronts;
  const listings = data?.curators?.reduce((total, curator) => total + (curator.liveListingCount || 0), 0);

  const facts = [
    { icon: Store, value: storefronts ?? "Live", label: "storefronts" },
    { icon: Box, value: listings ?? "Stocked", label: "physical listings" },
    { icon: BadgeCheck, value: agentReady ?? "Ready", label: "agent-ready curators" },
    { icon: Zap, value: "$0.03", label: "digital try-on" },
  ];

  return (
    <section className="border-y border-border/40 bg-muted/20">
      <div className="container mx-auto grid grid-cols-2 gap-px px-4 md:grid-cols-4 md:max-w-5xl">
        {facts.map(({ icon: Icon, value, label }) => (
          <div key={label} className="flex min-h-24 flex-col justify-center border-border/40 py-5 text-center odd:border-r md:border-r last:border-r-0">
            <div className="mx-auto flex items-center gap-2 text-primary">
              <Icon className="h-4 w-4" />
              <span className="text-2xl font-black tabular-nums">{value}</span>
            </div>
            <span className="mt-1 text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
