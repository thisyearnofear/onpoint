"use client";

import { useMemo } from "react";
import {
  Bell,
  CreditCard,
  MessageCircle,
  Eye,
  Sparkles,
  Truck,
} from "lucide-react";

interface Notification {
  id: string;
  curatorSlug: string;
  type: string;
  message: string;
  relatedId?: string;
  relatedType?: string;
  read?: boolean;
  createdAt: string;
}

const NOTIF_ICONS: Record<string, typeof Bell> = {
  new_payment: CreditCard,
  new_lead: MessageCircle,
  high_intent_view: Eye,
  delivery_submitted: Truck,
  payment_confirmed_stk: Sparkles,
};

const NOTIF_COLORS: Record<string, string> = {
  new_payment: "text-emerald-500",
  new_lead: "text-blue-500",
  high_intent_view: "text-violet-500",
  delivery_submitted: "text-amber-500",
  payment_confirmed_stk: "text-emerald-600",
};

const NOTIF_BG: Record<string, string> = {
  new_payment: "bg-emerald-500/10",
  new_lead: "bg-blue-500/10",
  high_intent_view: "bg-violet-500/10",
  delivery_submitted: "bg-amber-500/10",
  payment_confirmed_stk: "bg-emerald-500/10",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function labelize(value?: string) {
  if (!value) return "";
  return value.replaceAll("_", " ").replaceAll("-", " ");
}

export function NotificationsFeed({
  notifications,
}: {
  notifications: Notification[];
}) {
  const unreadCount = useMemo(
    () => notifications.filter((n) => n.read === false).length,
    [notifications],
  );

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2 font-bold">
            <Bell className="h-4 w-4 text-amber-500" />
            Notifications
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Real-time alerts for new payments, leads, and high-intent views.
          </p>
        </div>
        {unreadCount > 0 && (
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600">
            <Sparkles className="h-3.5 w-3.5" />
            {unreadCount} new
          </span>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground">
          No notifications yet. Activity will appear here as customers interact with the storefront.
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {notifications.slice(0, 10).map((notif) => {
            const Icon = NOTIF_ICONS[notif.type] || Bell;
            const colorClass = NOTIF_COLORS[notif.type] || "text-muted-foreground";
            const bgClass = NOTIF_BG[notif.type] || "bg-muted/30";

            return (
              <div
                key={notif.id}
                className={`flex items-start gap-3 rounded-lg border border-border p-3 transition-colors ${
                  notif.read === false ? "bg-card" : "bg-muted/15"
                }`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${bgClass}`}
                >
                  <Icon className={`h-4 w-4 ${colorClass}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${bgClass} ${colorClass}`}
                    >
                      {labelize(notif.type)}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {timeAgo(notif.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-foreground">
                    {notif.message}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
