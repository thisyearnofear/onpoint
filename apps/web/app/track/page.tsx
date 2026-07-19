"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import {
  ArrowLeft,
  Package,
  Truck,
  User,
  MapPin,
  Phone,
  Receipt,
  Loader2,
  AlertTriangle,
  ExternalLink,
  Radio,
  RefreshCw,
  Share2,
  Check,
  Bell,
  BellRing,
  BellOff,
} from "lucide-react";
import { TrackingTimeline } from "../../components/TrackingTimeline";
import { OnPointLayout } from "../../components/OnPointLayout";

type TrackingData = {
  found: boolean;
  orderNumber: string;
  payment: {
    id: string;
    status: string;
    fulfilmentStatus: string | null;
    amount: number;
    currency: string;
    itemName: string;
    size: string;
    mpesaCode: string | null;
    provider: string;
    createdAt: string | null;
    deliverySubmittedAt: string | null;
  };
  delivery: {
    recipientName: string;
    recipientPhone: string;
    deliveryAddress: string;
    deliveryNotes: string | null;
    pickupLocation: string | null;
    courierMethod: string;
  } | null;
  curator: {
    name: string;
    slug: string;
  };
};

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

const FULFILMENT_LABELS: Record<string, string> = {
  awaiting_delivery_details: "Delivery details received",
  ready_for_pickup: "Ready for courier pickup",
  rider_assigned: "Rider is on the way",
  delivered: "Delivered! 🎉",
};

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Convert a base64-encoded URL-safe VAPID public key to a Uint8Array. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

function TrackingPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAgo, setUpdatedAgo] = useState<number>(0);
  const [justRefreshed, setJustRefreshed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notifPermissionDenied, setNotifPermissionDenied] = useState(false);
  const [swRegistered, setSwRegistered] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant: "success" | "muted" } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevStatusRef = useRef<string | null>(null);
  const notifSentRef = useRef<Set<string>>(new Set());
  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const trackingParamsRef = useRef<{ pid: string; slug: string }>({ pid: "", slug: "" });

  /** Unsubscribe push subscription: call PushManager.unsubscribe() + delete from Redis. */
  const unsubscribePush = useCallback(async () => {
    const { pid, slug } = trackingParamsRef.current;
    if (!pid) return;

    // Delete from Redis first (best-effort)
    fetch("/api/curator/push-subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId: pid }),
    }).catch(() => {});

    // Unsubscribe from PushManager
    try {
      const reg = swRegistrationRef.current;
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
        }
      }
    } catch {
      // Silently fail — subscription may have expired
    }
  }, []);

  /** localStorage key scoped to a specific payment, so orders don't interfere. */
  const storageKey = useCallback((pid: string) => `onpoint_notifs_${pid}`, []);

  // Check notification permission on mount and restore persisted preference
  useEffect(() => {
    if (typeof Notification === "undefined") return;

    if (Notification.permission === "granted") {
      setNotificationsEnabled(true);
    } else if (Notification.permission === "denied") {
      setNotifPermissionDenied(true);
      // Clear any stale persisted preference for denied state
      const pid = searchParams.get("id");
      if (pid) {
        try {
          localStorage.removeItem(storageKey(pid));
        } catch { /* localStorage unavailable */ }
      }
    }
  }, [searchParams, storageKey]);

  // Register service worker on mount
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        swRegistrationRef.current = reg;
        setSwRegistered(true);
      })
      .catch(() => {
        // Service worker registration failed — continue without push
      });
  }, []);

  // Subscribe to push when notifications are enabled
  useEffect(() => {
    if (
      !notificationsEnabled ||
      pushSubscribed ||
      !swRegistrationRef.current ||
      !("PushManager" in window)
    )
      return;

    const pid = trackingParamsRef.current.pid;
    const slug = trackingParamsRef.current.slug;
    if (!pid || !slug) return;

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) return;

    const reg = swRegistrationRef.current;

    // Check if already subscribed
    reg.pushManager
      .getSubscription()
      .then((existingSub) => {
        if (existingSub) {
          // Already subscribed — just persist the existing subscription on the server
          const subJson = existingSub.toJSON();
          return fetch("/api/curator/push-subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              curatorSlug: slug,
              paymentId: pid,
              subscription: subJson,
            }),
          }).then((res) => {
            if (res.ok) setPushSubscribed(true);
          });
        }
        // No existing subscription — subscribe fresh
        return reg.pushManager
          .subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
          })
          .then((subscription) => {
            const subJson = subscription.toJSON();
            return fetch("/api/curator/push-subscribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                curatorSlug: slug,
                paymentId: pid,
                subscription: subJson,
              }),
            });
          })
          .then((res) => {
            if (res.ok) setPushSubscribed(true);
          });
      })
      .catch(() => {
        // Push subscription failed — continue with local notifications only
      });
  }, [notificationsEnabled, pushSubscribed, searchParams]);

  const showToast = useCallback((message: string, variant: "success" | "muted" = "muted") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, variant });
    toastTimerRef.current = setTimeout(() => setToast(null), 2000);
  }, []);

  const toggleNotifications = useCallback(async () => {
    if (typeof Notification === "undefined") return;

    if (notificationsEnabled) {
      // Turn off: unsubscribe push + reset state
      await unsubscribePush();
      setPushSubscribed(false);
      setNotificationsEnabled(false);
      showToast("Notifications turned off", "muted");
      try {
        localStorage.removeItem(storageKey(trackingParamsRef.current.pid));
      } catch { /* localStorage unavailable */ }
      return;
    }

    // Turn on: request permission
    try {
      const result = await Notification.requestPermission();
      if (result === "granted") {
        setNotificationsEnabled(true);
        setNotifPermissionDenied(false);
        showToast("Notifications enabled", "success");
        try {
          localStorage.setItem(storageKey(trackingParamsRef.current.pid), "true");
        } catch { /* localStorage unavailable */ }
      } else if (result === "denied") {
        setNotifPermissionDenied(true);
      }
    } catch {
      // Permission request failed
    }
  }, [notificationsEnabled, unsubscribePush]);

  useEffect(() => {
    const pid = searchParams.get("id") || "";
    const slug = searchParams.get("slug") || "";

    if (!pid || !slug) {
      setError("Missing tracking information. Please use the link from your receipt or WhatsApp message.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchTracking() {
      try {
        const res = await fetch(
          `/api/curator/tracking?id=${encodeURIComponent(pid)}&curatorSlug=${encodeURIComponent(slug)}`,
        );

        if (!res.ok) {
          if (res.status === 404) {
            throw new Error("Order not found. The tracking link may be invalid.");
          }
          throw new Error("Failed to load tracking information.");
        }

        const json = await res.json();
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Something went wrong");
          setLoading(false);
        }
      }
    }

    // Store params for unmount cleanup
    trackingParamsRef.current = { pid, slug };

    // Restore persisted notification preference from localStorage
    if (typeof localStorage !== "undefined") {
      try {
        const stored = localStorage.getItem(storageKey(pid));
        if (stored === "true" && Notification.permission === "granted") {
          setNotificationsEnabled(true);
        }
      } catch { /* localStorage unavailable */ }
    }

    fetchTracking();

    // Auto-refresh every 15 seconds if not yet delivered
    const interval = setInterval(async () => {
      if (cancelled) return;
      try {
        const res = await fetch(
          `/api/curator/tracking?id=${encodeURIComponent(pid)}&curatorSlug=${encodeURIComponent(slug)}`,
        );
        if (res.ok) {
          const json = await res.json();
          if (!cancelled) {
            const prevStatus = prevStatusRef.current;
            const newStatus = json.payment?.fulfilmentStatus || null;

            setData(json);
            setJustRefreshed(true);
            setUpdatedAgo(0);
            setTimeout(() => setJustRefreshed(false), 1500);

            // Fire background notification if status changed
            if (
              prevStatus !== null &&
              prevStatus !== newStatus &&
              document.hidden &&
              notificationsEnabled &&
              Notification.permission === "granted"
            ) {
              const notifKey = `${prevStatus}→${newStatus}`;
              if (!notifSentRef.current.has(notifKey)) {
                notifSentRef.current.add(notifKey);
                const label = FULFILMENT_LABELS[newStatus] || newStatus;
                new Notification("Order status updated", {
                  body: `${json.orderNumber}: ${label}`,
                  icon: "/favicon.ico",
                  tag: notifKey,
                  silent: false,
                });
              }
            }

            prevStatusRef.current = newStatus;

            // Stop refreshing once delivered
            if (json.payment?.fulfilmentStatus === "delivered") {
              clearInterval(interval);
              // Clear persisted notification preference — no more updates needed
              try {
                localStorage.removeItem(storageKey(pid));
              } catch { /* localStorage unavailable */ }
            }
          }
        }
      } catch {
        // Silently continue — don't show errors on auto-refresh
      }
    }, 15000);

    // Tick the "Updated Xs ago" counter every second
    const tick = setInterval(() => {
      setUpdatedAgo((prev) => prev + 1);
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      clearInterval(tick);
      // Unsubscribe push when navigating away from the page
      unsubscribePush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ── Loading state ──
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-success" />
          <p className="mt-3 text-sm text-muted-foreground">Loading tracking information...</p>
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (error || !data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20">
        <div className="rounded-xl border border-error/20 bg-error/5 p-6 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-red-400" />
          <h2 className="mt-4 text-lg font-bold text-foreground">Unable to load tracking</h2>
          <p className="mt-2 text-sm text-muted-foreground">{error || "Something went wrong."}</p>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to OnPoint
          </button>
        </div>
      </div>
    );
  }

  const { payment, delivery, curator, orderNumber } = data;
  const hasDelivery = delivery !== null;
  const isStk = payment.provider?.includes("stk");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      {/* Back link */}
      <button
        type="button"
        onClick={() => router.push(`/s/${curator.slug}`)}
        className="mb-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to {curator.name}&apos;s storefront
      </button>

      {/* Page header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Package className="h-3.5 w-3.5" />
            Order tracking
          </div>

          {/* Live indicator + refresh status */}
          {payment.fulfilmentStatus !== "delivered" && (
            <div className="flex items-center gap-2">
              <div className="relative group" tabIndex={0}>
                <span className="inline-flex cursor-default items-center gap-1.5 rounded-full border border-success/20 bg-success/10 px-2.5 py-0.5 text-[11px] font-medium text-success">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                  </span>
                  Live
                </span>

                {/* Live indicator tooltip */}
                <div className="absolute right-0 top-full z-20 mt-1.5 w-56 rounded-lg border border-border bg-card p-3 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200 max-w-[calc(100vw-2rem)]">
                  <p className="text-[11px] font-medium text-success">Auto-refreshing</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                    This page automatically refreshes every 15 seconds to check for order updates.
                  </p>
                </div>
              </div>

              {/* Connection status with tooltip */}
              <div className="relative group" tabIndex={0}>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-all duration-300 cursor-default ${
                    pushSubscribed
                      ? "border-success/20 bg-success/10 text-success"
                      : swRegistered
                        ? "border-blue-500/20 bg-blue-500/10 text-blue-600"
                        : "border-border bg-muted/50 text-muted-foreground"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      pushSubscribed
                        ? "bg-success"
                        : swRegistered
                          ? "bg-blue-500"
                          : "bg-muted-foreground/40"
                    }`}
                  />
                  {pushSubscribed
                    ? "Push active"
                    : swRegistered
                      ? "Polling"
                      : "Connecting…"}
                </span>

                {/* State explanation tooltip */}
                <div className="absolute right-0 top-full z-20 mt-1.5 w-64 rounded-lg border border-border bg-card p-3 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200 max-w-[calc(100vw-2rem)]">
                  {pushSubscribed ? (
                    <>
                      <p className="text-[11px] font-medium text-success">Push active</p>
                      <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                        Real-time notifications are active. You&apos;ll be notified instantly when your order status changes, even if this page is closed.
                      </p>
                    </>
                  ) : swRegistered ? (
                    <>
                      <p className="text-[11px] font-medium text-blue-600">Polling</p>
                      <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                        Service worker is registered. This page checks for updates every 15 seconds. Enable notifications for real-time updates.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-[11px] font-medium text-muted-foreground">Connecting</p>
                      <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                        Setting up the background service for order updates. This should complete momentarily.
                      </p>
                    </>
                  )}
                </div>
              </div>
              <span
                className={`inline-flex items-center gap-1 text-[10px] text-muted-foreground/60 transition-all duration-300 ${
                  justRefreshed
                    ? "translate-x-0 opacity-100"
                    : "translate-x-0 opacity-100"
                }`}
              >
                <RefreshCw
                  className={`h-2.5 w-2.5 transition-all duration-500 ${
                    justRefreshed ? "animate-spin-once text-success" : ""
                  }`}
                />
                {justRefreshed
                  ? "Updated just now"
                  : updatedAgo < 60
                    ? `Updated ${updatedAgo}s ago`
                    : `Updated ${Math.floor(updatedAgo / 60)}m ago`}
              </span>
            </div>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
            {orderNumber}
          </h1>

          {/* Share tracking link */}
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(window.location.href);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                // Clipboard API not available — silently fail
              }
            }}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition-all duration-300 ${
              copied
                ? "border-success/30 bg-success/10 text-success"
                : "border-border bg-background text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground"
            }`}
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" />
                Copied!
              </>
            ) : (
              <>
                <Share2 className="h-3 w-3" />
                Share tracking
              </>
            )}
          </button>

          {/* Browser notifications toggle */}
          {payment.fulfilmentStatus !== "delivered" && (
            <div className="relative group">
              <button
                type="button"
                onClick={toggleNotifications}
                disabled={notifPermissionDenied}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition-all duration-300 ${
                  notificationsEnabled
                    ? "border-success/30 bg-success/10 text-success"
                    : notifPermissionDenied
                      ? "border-error/20 bg-error/5 text-muted-foreground/50 cursor-not-allowed"
                      : "border-border bg-background text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground"
                }`}
              >
                {notificationsEnabled ? (
                  <>
                    <BellRing className="h-3 w-3" />
                    Notifications on
                  </>
                ) : notifPermissionDenied ? (
                  <>
                    <BellOff className="h-3 w-3" />
                    Blocked
                  </>
                ) : (
                  <>
                    <Bell className="h-3 w-3" />
                    Get notified
                  </>
                )}
              </button>

              {/* Unblock tooltip — subtle, appears on hover/focus only */}
              {notifPermissionDenied && (
                <div className="absolute right-0 top-full z-20 mt-1.5 w-64 rounded-lg border border-border bg-card p-3 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200">
                  <p className="text-[11px] font-medium text-foreground">Notifications blocked</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                    Open your browser settings &rarr; Privacy &amp; security &rarr; Site settings &rarr; Notifications &rarr; allow this site.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <p className="mt-1 text-sm text-muted-foreground">
          Ordered from <span className="font-semibold text-foreground">{curator.name}</span>
          {payment.createdAt && <> · {formatDate(payment.createdAt)}</>}
        </p>
      </div>

      <div className="grid gap-6">
        {/* ── Timeline ── */}
        <div className="rounded-xl border border-border bg-card p-5">
          <TrackingTimeline
            paymentStatus={payment.status}
            fulfilmentStatus={payment.fulfilmentStatus}
            hasDelivery={hasDelivery}
            createdAt={payment.createdAt}
          />
        </div>

        {/* ── Order summary ── */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-3">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Order summary
            </span>
          </div>
          <div className="divide-y divide-border/50 px-4 py-2 text-sm">
            <Row label="Order" value={orderNumber} mono />
            <Row label="Item" value={payment.itemName || "—"} />
            <Row label="Size" value={payment.size || "—"} />
            <Row
              label="Total"
              value={formatMoney(Number(payment.amount) || 0, payment.currency || "KES")}
              highlight
            />
            <Row
              label="Payment"
              value={
                <span className="inline-flex items-center gap-1.5">
                  {payment.mpesaCode ? (
                    <>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                        {payment.mpesaCode}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {isStk ? "(Auto-pay)" : "(Manual)"}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">
                      {isStk ? "Auto-pay (STK)" : "Manual M-Pesa"}
                    </span>
                  )}
                </span>
              }
            />
          </div>
        </div>

        {/* ── Delivery details ── */}
        {hasDelivery && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-3">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Delivery details
              </span>
            </div>
            <div className="divide-y divide-border/50 px-4 py-2 text-sm">
              <Row
                label="Recipient"
                value={
                  <span className="inline-flex items-center gap-1">
                    <User className="h-3 w-3 text-muted-foreground" />
                    {delivery!.recipientName}
                  </span>
                }
              />
              <Row
                label="Phone"
                value={
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    {delivery!.recipientPhone}
                  </span>
                }
              />
              <Row
                label="Address"
                value={
                  <span className="inline-flex items-start gap-1">
                    <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                    {delivery!.deliveryAddress}
                  </span>
                }
              />
              {delivery!.pickupLocation && (
                <Row label="Pickup" value={delivery!.pickupLocation} />
              )}
              <Row label="Courier" value={delivery!.courierMethod} />
              {delivery!.deliveryNotes && (
                <Row label="Notes" value={delivery!.deliveryNotes} />
              )}
            </div>
          </div>
        )}

        {/* ── Waiting for delivery ── */}
        {!hasDelivery && (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-5 text-center">
            <Truck className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium text-foreground">
              Awaiting delivery details
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {curator.name} will reach out to confirm delivery once the payment is verified.
            </p>
          </div>
        )}

        {/* ── Need help? ── */}
        <div className="rounded-xl border border-border bg-muted/25 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Questions about your order?
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Contact <span className="font-medium text-foreground">{curator.name}</span> directly for updates on your order.
          </p>
          <button
            type="button"
            onClick={() => router.push(`/s/${curator.slug}`)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Visit storefront
          </button>
        </div>

        {/* ── Auto-refresh notice ── */}
        {payment.fulfilmentStatus !== "delivered" && (
          <p className="text-center text-[10px] text-muted-foreground/50">
            This page refreshes automatically every 15 seconds.
          </p>
        )}
      </div>

      {/* ── Toast notifications ── */}
      <div
        className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transform transition-all duration-300 ${
          toast
            ? "translate-y-0 opacity-100"
            : "translate-y-3 opacity-0 pointer-events-none"
        }`}
      >
        <div
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 shadow-lg ${
            toast?.variant === "success"
              ? "border-success/30 bg-success/10"
              : "border-border bg-background"
          }`}
        >
          {toast?.variant === "success" && <BellRing className="h-3 w-3 text-success" />}
          <span
            className={`text-xs ${
              toast?.variant === "success" ? "font-medium text-success" : "text-foreground"
            }`}
          >
            {toast?.message}
          </span>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span
        className={`text-right text-xs ${
          highlight
            ? "font-bold text-foreground"
            : mono
              ? "font-mono text-foreground"
              : "text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export default function TrackingPage() {
  return (
    <OnPointLayout footer={false}>
      <Suspense
        fallback={
          <div className="flex min-h-[60vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-success" />
          </div>
        }
      >
        <TrackingPageInner />
      </Suspense>
    </OnPointLayout>
  );
}
