import Link from "next/link";
import {
  Store,
  TrendingUp,
  Users,
  ArrowRight,
} from "lucide-react";

function getApiBase() {
  return (
    process.env.NEXT_PUBLIC_AGENT_API_URL ||
    process.env.AGENT_API_URL ||
    "http://localhost:48751"
  ).replace(/\/$/, "");
}

async function getCuratorCount(): Promise<{ total: number; withListings: number }> {
  try {
    const res = await fetch(`${getApiBase()}/api/admin/curators`, {
      cache: "no-store",
    });
    if (!res.ok) return { total: 0, withListings: 0 };
    const data = await res.json();
    return {
      total: data.total || 0,
      withListings: data.curators?.filter((c: { listingCount: number }) => c.listingCount > 0).length || 0,
    };
  } catch {
    return { total: 0, withListings: 0 };
  }
}

export default async function AdminDashboardPage() {
  const stats = await getCuratorCount();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage curators, listings, and platform operations.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Store className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-black">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total curators</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-black">{stats.withListings}</p>
              <p className="text-xs text-muted-foreground">With live listings</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
              <Users className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <p className="text-2xl font-black">{stats.total > 0 ? Math.round((stats.withListings / stats.total) * 100) : 0}%</p>
              <p className="text-xs text-muted-foreground">With inventory</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="space-y-3">
        <h2 className="font-bold">Quick actions</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/admin/curators"
            className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center gap-3">
              <Store className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Manage curators</p>
                <p className="text-xs text-muted-foreground">View, edit, and onboard curators</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>

          <Link
            href="/curator/onboard"
            className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-emerald-500" />
              <div>
                <p className="font-medium">Onboard new curator</p>
                <p className="text-xs text-muted-foreground">Self-serve registration form</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </div>
      </div>
    </div>
  );
}
