import Link from "next/link";
import {
  Store,
  ExternalLink,
  MessageCircle,
  ShoppingBag,
  Plus,
} from "lucide-react";

interface CuratorRow {
  slug: string;
  name: string;
  type: string;
  verticals: string[];
  createdAt: string;
  channels: { whatsapp?: string };
  brand: { colors?: { primary?: string } };
  commerce: { checkout?: string };
  listingCount: number;
}

interface ListResponse {
  curators: CuratorRow[];
  total: number;
}

function getApiBase() {
  return (
    process.env.NEXT_PUBLIC_AGENT_API_URL ||
    process.env.AGENT_API_URL ||
    "http://localhost:48751"
  ).replace(/\/$/, "");
}

async function getCurators(): Promise<ListResponse> {
  try {
    const res = await fetch(`${getApiBase()}/api/admin/curators`, {
      cache: "no-store",
    });
    if (!res.ok) return { curators: [], total: 0 };
    return res.json();
  } catch {
    return { curators: [], total: 0 };
  }
}

function getStorefrontUrl(slug: string) {
  return `https://onpoint.famile.xyz/s/${slug}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function CuratorListPage() {
  const { curators: rows, total } = await getCurators();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Curators</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} curator{total !== 1 ? "s" : ""} registered
          </p>
        </div>
        <Link
          href="/curator/onboard"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New curator
        </Link>
      </div>

      {/* Empty state */}
      {rows.length === 0 ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <Store className="h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-bold">No curators yet</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Onboard your first curator to get started. They&apos;ll get a
            branded storefront with try-on and WhatsApp checkout.
          </p>
          <Link
            href="/curator/onboard"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Onboard first curator
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Curator
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Verticals
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Listings
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Checkout
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Created
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((curator) => (
                <tr
                  key={curator.slug}
                  className="transition-colors hover:bg-muted/30"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white"
                        style={{
                          background:
                            curator.brand?.colors?.primary || "#6366f1",
                        }}
                      >
                        {curator.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <Link
                          href={`/admin/curators/${curator.slug}`}
                          className="font-medium hover:text-primary transition-colors"
                        >
                          {curator.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {curator.slug}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {curator.verticals?.slice(0, 2).map((v) => (
                        <span
                          key={v}
                          className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                        >
                          {v.replaceAll("-", " ")}
                        </span>
                      ))}
                      {(curator.verticals?.length || 0) > 2 && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                          +{curator.verticals.length - 2}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        curator.listingCount > 0
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <ShoppingBag className="h-3 w-3" />
                      {curator.listingCount}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {curator.channels?.whatsapp ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                        <MessageCircle className="h-3 w-3" />
                        WhatsApp
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {curator.commerce?.checkout || "—"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDate(curator.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/admin/curators/${curator.slug}`}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        View
                      </Link>
                      <a
                        href={getStorefrontUrl(curator.slug)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        title="View storefront"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
