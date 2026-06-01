import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  ClipboardList,
  CreditCard,
  ExternalLink,
  Eye,
  MapPin,
  MessageCircle,
  ShoppingBag,
  Globe,
  Palette,
  Calendar,
  ToggleLeft,
  Truck,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { CuratorReplyTemplates } from "./CuratorReplyTemplates";
import { CrossCuratorSummaryCard } from "./CrossCuratorSummaryCard";
import { PaymentsTable } from "./PaymentsTable";
import { NotificationsFeed } from "./NotificationsFeed";

interface CuratorDetail {
  slug: string;
  name: string;
  type: string;
  verticals: string[];
  channels: {
    whatsapp?: string;
    telegram?: string;
    instagram?: string;
  };
  brand: {
    logo?: string;
    colors?: {
      primary?: string;
      accent?: string;
    };
    shareCopy?: string;
    location?: {
      city?: string;
      landmark?: string;
    };
  };
  commerce: {
    checkout?: string;
    checkoutUrl?: string;
    whatsappTemplate?: string;
    revShare?: number;
  };
  createdAt: string;
  listingCount: number;
}

interface CuratorLead {
  id: string;
  curatorSlug: string;
  listingId?: string | null;
  styleProfile?: string | null;
  selectedItem?: string | null;
  source?: string | null;
  marketIntent?: string | null;
  action?: string | null;
  createdAt: string;
}

interface CuratorPayment {
  id: string;
  curatorSlug: string;
  listingId?: string | null;
  itemName?: string | null;
  size?: string | null;
  amount?: number | null;
  currency?: string | null;
  customerPhone?: string | null;
  mpesaCode?: string | null;
  status?: string | null;
  fulfilmentStatus?: string | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
  deliveryAddress?: string | null;
  deliveryNotes?: string | null;
  pickupLocation?: string | null;
  courierMethod?: string | null;
  createdAt: string;
}

interface CuratorNotification {
  id: string;
  curatorSlug: string;
  type: string;
  message: string;
  relatedId?: string;
  relatedType?: string;
  read?: boolean;
  createdAt: string;
}

async function getCurator(slug: string): Promise<CuratorDetail | null> {
  try {
    const res = await fetch(
      `/api/admin/proxy/curators/${encodeURIComponent(slug)}`,
      { cache: "no-store" },
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    const data = await res.json();
    return data.curator;
  } catch {
    return null;
  }
}

async function getCuratorPayments(slug: string): Promise<CuratorPayment[]> {
  const serviceKey = process.env.SERVICE_API_KEY || "";
  if (!serviceKey) return [];

  try {
    const res = await fetch(
      `/api/curator/payments?curatorSlug=${encodeURIComponent(slug)}`,
      {
        cache: "no-store",
        headers: {
          "x-service-key": serviceKey,
        },
      },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.payments) ? data.payments : [];
  } catch {
    return [];
  }
}

async function getCuratorNotifications(slug: string): Promise<CuratorNotification[]> {
  const serviceKey = process.env.SERVICE_API_KEY || "";
  if (!serviceKey) return [];

  try {
    const res = await fetch(
      `/api/curator/notifications?curatorSlug=${encodeURIComponent(slug)}`,
      {
        cache: "no-store",
        headers: {
          "x-service-key": serviceKey,
        },
      },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.notifications) ? data.notifications : [];
  } catch {
    return [];
  }
}

async function getCuratorLeads(slug: string): Promise<CuratorLead[]> {
  const serviceKey = process.env.SERVICE_API_KEY || "";
  if (!serviceKey) return [];

  try {
    const res = await fetch(
      `/api/curator/leads?curatorSlug=${encodeURIComponent(slug)}`,
      {
        cache: "no-store",
        headers: {
          "x-service-key": serviceKey,
        },
      },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.leads) ? data.leads : [];
  } catch {
    return [];
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(iso?: string) {
  if (!iso) return "Unknown";
  return new Date(iso).toLocaleString("en-KE", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function labelize(value?: string | null) {
  if (!value) return "—";
  return value.replaceAll("_", " ").replaceAll("-", " ");
}

function getStorefrontUrl(slug: string) {
  return `https://onpoint.famile.xyz/s/${slug}`;
}

export default async function CuratorDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [curator, leads, payments, notifications] = await Promise.all([
    getCurator(slug),
    getCuratorLeads(slug),
    getCuratorPayments(slug),
    getCuratorNotifications(slug),
  ]);

  if (!curator) {
    notFound();
  }

  const primary = curator.brand?.colors?.primary || "#6366f1";
  const accent = curator.brand?.colors?.accent || "#e94560";

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href="/admin/curators"
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Curators
        </Link>
        <span>/</span>
        <span className="text-foreground">{curator.name}</span>
      </div>

      {/* Header card */}
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="flex h-2" style={{ background: `linear-gradient(90deg, ${primary}, ${accent})` }} />        <div className="p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0 max-w-full">
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-black text-white shadow-lg"
                style={{ background: primary }}
              >
                {curator.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight truncate">{curator.name}</h1>
                <p className="text-sm text-muted-foreground">@{curator.slug}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {curator.verticals?.map((v) => (
                    <span
                      key={v}
                      className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                    >
                      {v.replaceAll("-", " ")}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex w-full sm:w-auto gap-2">
              <a
                href={getStorefrontUrl(curator.slug)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                <Eye className="h-4 w-4" />
                Preview storefront
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <Link
                href={`/admin/curators/${curator.slug}/listings`}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                <ShoppingBag className="h-4 w-4" />
                Listings
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <ShoppingBag className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-black">{curator.listingCount}</p>
              <p className="text-xs text-muted-foreground">Listings</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">{formatDate(curator.createdAt)}</p>
              <p className="text-xs text-muted-foreground">Joined</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
              {curator.channels?.whatsapp ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-500" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium">
                {curator.channels?.whatsapp ? "WhatsApp connected" : "No WhatsApp"}
              </p>
              <p className="text-xs text-muted-foreground">
                {curator.channels?.whatsapp || "Checkout method: " + (curator.commerce?.checkout || "whatsapp")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Cross-curator recommendation stats */}
      <CrossCuratorSummaryCard slug={slug} />

      {/* Notifications feed */}
      <NotificationsFeed notifications={notifications} />

      {/* Recent M-Pesa payments */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="flex items-center gap-2 font-bold">
              <CreditCard className="h-4 w-4 text-emerald-500" />
              M-Pesa payments
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Manual payment confirmations submitted from the storefront. Verify against M-Pesa before fulfilment.
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <CreditCard className="h-3.5 w-3.5" />
            {payments.length} payment{payments.length === 1 ? "" : "s"}
          </span>
        </div>

        <PaymentsTable curatorName={curator.name} payments={payments} />
      </div>

      {/* Recent curator demand */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="flex items-center gap-2 font-bold">
              <ClipboardList className="h-4 w-4 text-primary" />
              Recent demand
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Leads captured when shoppers send style briefs or Intel creates curator actions.
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <Bell className="h-3.5 w-3.5" />
            {leads.length} lead{leads.length === 1 ? "" : "s"}
          </span>
        </div>

        {leads.length > 0 ? (
          <div className="mt-4 overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Source</th>
                  <th className="px-3 py-2 text-left font-medium">Item / intent</th>
                  <th className="px-3 py-2 text-left font-medium">Profile</th>
                  <th className="px-3 py-2 text-left font-medium">Action</th>
                  <th className="px-3 py-2 text-right font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {leads.slice(0, 8).map((lead) => (
                  <tr key={lead.id} className="align-top">
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium capitalize text-primary">
                        {labelize(lead.source)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium">{lead.selectedItem || lead.marketIntent || "Curator brief"}</p>
                      {lead.listingId && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Listing {lead.listingId.slice(0, 8)}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {lead.styleProfile || "—"}
                    </td>
                    <td className="px-3 py-3 capitalize text-muted-foreground">
                      {labelize(lead.action)}
                    </td>
                    <td className="px-3 py-3 text-right text-xs text-muted-foreground">
                      {formatDateTime(lead.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground">
            No demand captured yet. Use the storefront try-on flow or the Intel page curator actions to create the first lead.
          </div>
        )}
      </div>

      {/* Curator operator needs */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-emerald-500" />
          <h2 className="font-bold">{curator.name}'s operator needs</h2>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[
            {
              icon: ToggleLeft,
              title: "Inventory controls",
              body: "Fast availability toggles, size updates, and plain vs printed options with name and number.",
            },
            {
              icon: CreditCard,
              title: "Kenya payments",
              body: "M-Pesa checkout that reflects payment clearly for the curator and shopper.",
            },
            {
              icon: Truck,
              title: "Delivery handoff",
              body: "Secure delivery address capture shaped around Bolt Send pickup, recipient, and contact details.",
            },
            {
              icon: Eye,
              title: "Viewing notifications",
              body: "Alerts for views, time spent, receipt of items, payments, and high-intent shoppers.",
            },
            {
              icon: ClipboardList,
              title: "Template replies",
              body: "Reusable response snippets for sizing, printing, payment, delivery, and stock confirmations.",
            },
            {
              icon: MapPin,
              title: "Specialist verticals",
              body: `${curator.name} specializes in sports attire; future curators can own other garment categories.`,
            },
          ].map((need) => (
            <div key={need.title} className="rounded-lg border border-border bg-muted/25 p-3">
              <div className="flex items-center gap-2">
                <need.icon className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">{need.title}</p>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{need.body}</p>
            </div>
          ))}
        </div>
      </div>

      <CuratorReplyTemplates
        curatorName={curator.name}
        verticals={curator.verticals || []}
      />

      {/* Details sections */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Channels */}
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <h2 className="flex items-center gap-2 font-bold">
            <MessageCircle className="h-4 w-4 text-emerald-500" />
            Channels
          </h2>
          <div className="mt-4 space-y-3 text-sm">
            {curator.channels?.whatsapp ? (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">WhatsApp</span>
                <a
                  href={`https://wa.me/${curator.channels.whatsapp.replace(/^\+/, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-emerald-600 hover:text-emerald-500"
                >
                  {curator.channels.whatsapp}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ) : (
              <p className="text-muted-foreground italic">No channels configured</p>
            )}
            {curator.channels?.telegram && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Telegram</span>
                <span>{curator.channels.telegram}</span>
              </div>
            )}
            {curator.channels?.instagram && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Instagram</span>
                <span>{curator.channels.instagram}</span>
              </div>
            )}
          </div>
        </div>

        {/* Commerce */}
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <h2 className="flex items-center gap-2 font-bold">
            <ShoppingBag className="h-4 w-4 text-primary" />
            Commerce
          </h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Checkout method</span>
              <span className="font-medium capitalize">
                {curator.commerce?.checkout || "whatsapp"}
              </span>
            </div>
            {curator.commerce?.revShare !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Revenue share</span>
                <span className="font-medium">
                  {(curator.commerce.revShare * 100).toFixed(0)}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Brand */}
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <h2 className="flex items-center gap-2 font-bold">
            <Palette className="h-4 w-4 text-violet-500" />
            Brand
          </h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-muted-foreground shrink-0">Primary</span>
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="h-5 w-5 shrink-0 rounded-md border border-border"
                  style={{ background: primary }}
                />
                <code className="truncate max-w-[140px] rounded bg-muted px-2 py-0.5 text-xs font-mono">
                  {primary}
                </code>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-muted-foreground shrink-0">Accent</span>
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="h-5 w-5 shrink-0 rounded-md border border-border"
                  style={{ background: accent }}
                />
                <code className="truncate max-w-[140px] rounded bg-muted px-2 py-0.5 text-xs font-mono">
                  {accent}
                </code>
              </div>
            </div>
            {curator.brand?.location?.city && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Location</span>
                <span className="font-medium">
                  {curator.brand.location.city}
                  {curator.brand.location.landmark
                    ? `, ${curator.brand.location.landmark}`
                    : ""}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Storefront link */}
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <h2 className="flex items-center gap-2 font-bold">
            <Globe className="h-4 w-4 text-sky-500" />
            Storefront
          </h2>
          <div className="mt-4 space-y-3">
            <a
              href={getStorefrontUrl(curator.slug)}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm font-mono text-primary transition-colors hover:bg-muted"
            >
              {getStorefrontUrl(curator.slug)}
            </a>
            <p className="text-xs text-muted-foreground">
              Share this link with customers. They get try-on, polaroid, and
              WhatsApp checkout — no app needed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
