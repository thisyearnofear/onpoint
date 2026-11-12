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
  const [earnings, storefront, dashboard] = await Promise.all([
    fetch(`${api}/api/curator/nia/earnings`).then((r) => r.json()),
    fetch(`${api}/api/curator/nia/storefront`).then((r) => r.json()),
    fetch(`${api}/api/agent/dashboard`).then((r) => r.json()),
  ]);

  const tryons: Row[] = (earnings.tryOns || []).map((t: any) => ({
    id: t.id,
    amount_usd: Number(t.amountCusd),
    rail: detectRail(String(t.paymentTx || "")),
    tx: t.paymentTx,
    at: t.createdAt,
  }));
  const listings: Row[] = (storefront.listings || []).map((l: any) => ({
    id: l.id,
    title: l.title,
    price_usd: l.pricing?.priceCusd ?? l.priceCusd ?? null,
    type: l.attributes?.type || "",
    formality: l.attributes?.formality || "",
    warmth: l.attributes?.warmth || "",
    colors: (l.attributes?.colors || []).join(", "),
    status: l.status || "",
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
              "OnPoint agent-commerce ledger: paid AI try-ons with their payment rail (paypal capture ids, celo 0x hashes, near tx ids), the curator's live listings, and the agent's signed receipt activity.",
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
