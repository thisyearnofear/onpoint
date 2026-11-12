"use client";

/**
 * Agent commerce studio — AG Studio over the live public ledger.
 * Sources: paid try-ons (curator earnings), storefront listings, agent
 * activity. The AI panel runs Studio's Agent Framework through our metered
 * Otari proxy — the same gateway that reads fit on /pay.
 */

import { useEffect, useState } from "react";
import { AgStudio, AgStudioProvider } from "ag-studio-react";
import { AgStudioAiModule, createAiHarness } from "ag-studio";
import { getApiBase } from "@/lib/utils/api-base";
import { otariAdapter } from "@/lib/studio/otari-adapter";
import { Skeleton, ErrorState } from "@/components/state";

type Row = Record<string, unknown>;

function detectRail(tx: string): string {
  if (/^0x[0-9a-f]{20,}$/i.test(tx)) return "celo";
  if (/^[A-Z0-9]{10,32}$/.test(tx)) return "paypal";
  return "near";
}

async function loadSources(api: string): Promise<Row[]> {
  const [niaEarnings, c3Earnings, niaStore, c3Store, dashboard] = await Promise.all([
    fetch(`${api}/api/curator/nia/earnings`).then((r) => r.json()),
    fetch(`${api}/api/curator/channel3/earnings`).then((r) => r.json()),
    fetch(`${api}/api/curator/nia/storefront`).then((r) => r.json()),
    fetch(`${api}/api/curator/channel3/storefront`).then((r) => r.json()),
    fetch(`${api}/api/agent/dashboard`).then((r) => r.json()),
  ]);

  const tryons: Row[] = [
    ...(niaEarnings.tryOns || []).map((t: any) => ({ ...t, curator: "nia" })),
    ...(c3Earnings.tryOns || []).map((t: any) => ({ ...t, curator: "channel3" })),
  ].map((t: any) => ({
    id: t.id,
    curator: t.curator,
    amount_usd: Number(t.amountCusd),
    rail: detectRail(String(t.paymentTx || "")),
    tx: t.paymentTx,
    at: t.createdAt,
  }));
  const listings: Row[] = [
    ...(niaStore.listings || []).map((l: any) => ({ ...l, curator: "nia" })),
    ...(c3Store.listings || []).map((l: any) => ({ ...l, curator: "channel3" })),
  ].map((l: any) => ({
    id: l.id,
    curator: l.curator,
    title: l.title,
    price_usd: l.attributes?.price ?? l.pricing?.priceCusd ?? l.priceCusd ?? null,
    brand: l.attributes?.brand || "",
    category: l.attributes?.category || l.attributes?.type || "",
    source: l.attributes?.source || "",
    status: l.status || "",
    offer_url: l.attributes?.offerUrl || "",
  }));
  const actions: Row[] = (dashboard.activity?.recentReceipts || []).map((r: any) => ({
    action: r.action,
    chain: r.chain,
    tx: r.txHash,
    at: r.timestamp,
  }));

  return [
    { id: "tryons", name: "Paid try-ons", data: tryons },
    { id: "listings", name: "Listings", data: listings },
    { id: "agent_actions", name: "Agent activity", data: actions },
  ] as unknown as Row[];
}

export function StudioShell() {
  const [sources, setSources] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const api = getApiBase();

  useEffect(() => {
    loadSources(api).then(setSources).catch((e) => setError(String(e?.message || e)));
  }, [api]);

  if (error) {
    return (
      <ErrorState
        title="The ledger didn't load"
        message={`I couldn't reach the API — ${error}. The studio needs the public earnings, storefront and dashboard endpoints.`}
        onRetry={() => {
          setError(null);
          setSources(null);
          loadSources(api).then(setSources).catch((e) => setError(String(e?.message || e)));
        }}
      />
    );
  }
  if (!sources) {
    return <Skeleton className="h-[78vh] w-full" />;
  }

  return (
    <div style={{ height: "78vh", minHeight: 480 }}>
      <AgStudioProvider modules={[AgStudioAiModule]}>
        <AgStudio
          mode="edit"
          data={{
            sources: sources as any,
            description:
              "OnPoint agent-commerce ledger: paid AI try-ons across two curators (nia, channel3) with their payment rail (paypal capture ids, celo 0x hashes, near tx ids), 24 live listings with brand/price/offer links, and the agent's signed receipt activity.",
          }}
          ai={({ api: studioApi }) =>
            createAiHarness(studioApi as any, {
              adapter: otariAdapter({ endpoint: `${api}/api/agent/studio-ai` }),
              primary: "lead",
            })
          }
        />
      </AgStudioProvider>
    </div>
  );
}
