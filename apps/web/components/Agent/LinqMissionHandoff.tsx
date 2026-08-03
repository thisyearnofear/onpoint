"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ContactRound,
  Copy,
  Loader2,
  MessageCircle,
  QrCode,
  Smartphone,
} from "lucide-react";

interface LinqMission {
  status:
    | "ready"
    | "connected"
    | "sent"
    | "delivered"
    | "delivery_failed"
    | "completed"
    | "opted_out";
  mode: "live" | "mock";
  phoneNumber: string;
  vcfUrl: string | null;
  message: string;
  connected: boolean;
  maskedHandle: string | null;
  service: "iMessage" | "RCS" | "SMS" | null;
  messageDelivered: boolean;
  updatedAt: string;
}

export function LinqMissionHandoff({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const [mission, setMission] = useState<LinqMission | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<"number" | "code" | null>(null);
  const requestInFlight = useRef(false);

  const refreshMission = useCallback(
    async (quiet = false) => {
      if (requestInFlight.current) return;
      requestInFlight.current = true;
      if (!quiet) setLoading(true);
      try {
        const response = await fetch(`/linq/mission/${orderId}`, {
          cache: "no-store",
        });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error || "Messages handoff is unavailable");
        }
        setMission(body);
        setError(null);
      } catch (reason) {
        if (!quiet) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Messages handoff is unavailable",
          );
        }
      } finally {
        requestInFlight.current = false;
        if (!quiet) setLoading(false);
      }
    },
    [orderId],
  );

  useEffect(() => {
    if (!open || mission) return;
    void refreshMission();
  }, [mission, open, refreshMission]);

  useEffect(() => {
    if (
      !open ||
      mission?.messageDelivered ||
      mission?.status === "delivery_failed"
    )
      return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshMission(true);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [mission?.messageDelivered, mission?.status, open, refreshMission]);

  const messagesHref = mission
    ? `sms:${mission.phoneNumber}?&body=${encodeURIComponent(mission.message)}`
    : null;

  useEffect(() => {
    if (!messagesHref) return;
    let active = true;
    import("qrcode")
      .then(({ toDataURL }) =>
        toDataURL(messagesHref, {
          errorCorrectionLevel: "M",
          margin: 1,
          width: 224,
          color: { dark: "#111111", light: "#ffffff" },
        }),
      )
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [messagesHref]);

  const copy = async (kind: "number" | "code", value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1400);
  };

  const connected = !!mission?.connected;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="group flex min-h-[58px] w-full items-center justify-between bg-card px-3 py-3 text-left transition-colors hover:bg-muted/40"
        aria-expanded={open}
        aria-controls={`linq-handoff-${orderId}`}
      >
        <span>
          <span
            className={`font-mono text-[8px] font-bold uppercase tracking-[0.14em] ${
              connected
                ? "text-emerald-600 dark:text-emerald-300"
                : "text-primary"
            }`}
          >
            LINQ · {connected ? "CONNECTED" : mission?.mode === "live" ? "LIVE" : "MESSAGES"}
          </span>
          <span className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-foreground">
            {connected ? "Mission on your phone" : "Continue in Messages"}
            {connected ? (
              <Check className="h-3 w-3 text-emerald-500" />
            ) : (
              <MessageCircle className="h-3 w-3" />
            )}
          </span>
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          id={`linq-handoff-${orderId}`}
          className="col-span-2 bg-[#f7f7f5] p-4 text-[#171717] dark:bg-[#111311] dark:text-[#f5f5f0] sm:p-5"
        >
          {loading && !mission ? (
            <div className="flex min-h-44 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Preparing your Linq handoff…
            </div>
          ) : error && !mission ? (
            <div className="py-8 text-center">
              <p className="text-sm font-semibold">Messages handoff unavailable</p>
              <p className="mt-1 text-xs text-muted-foreground">{error}</p>
              <button
                type="button"
                onClick={() => void refreshMission()}
                className="mt-4 rounded-full border border-black/15 px-4 py-2 text-xs font-bold dark:border-white/20"
              >
                Try again
              </button>
            </div>
          ) : mission ? (
            connected ? (
              <div
                className={`relative overflow-hidden rounded-2xl px-5 py-5 text-white ${
                  mission.status === "delivery_failed"
                    ? "bg-[#9a4b16]"
                    : mission.messageDelivered
                      ? "bg-[#0e6f42]"
                      : "bg-[#0959bf]"
                }`}
              >
                <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full border border-white/15" />
                <div className="absolute -right-2 top-7 h-16 w-16 rounded-full border border-white/10" />
                <div className="relative flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#0e6f42]">
                    {mission.status === "delivery_failed" ? (
                      <MessageCircle className="h-5 w-5 text-[#9a4b16]" />
                    ) : mission.messageDelivered ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <Loader2 className="h-5 w-5 animate-spin text-[#0959bf]" />
                    )}
                  </span>
                  <div>
                    <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-white/70">
                      Live Linq handoff
                    </p>
                    <p className="mt-1 text-lg font-bold">
                      {mission.status === "delivery_failed"
                        ? "Phone linked · delivery needs retry"
                        : mission.messageDelivered
                          ? "Mission delivered"
                          : "Phone linked · sending card"}
                    </p>
                    <p className="mt-1 text-sm text-white/80">
                      {mission.maskedHandle || "Your phone"} · {mission.service || "Messages"}
                    </p>
                    <p className="mt-4 max-w-md text-xs leading-relaxed text-white/75">
                      {mission.status === "delivery_failed"
                        ? "Your number remains linked to this quote. Reopen Messages and send the mission code again to retry the handoff."
                        : mission.messageDelivered
                          ? "The same quote is now active in Messages. Tap 👍 on its card to refresh status; authorization remains on Prava."
                          : "Linq accepted the handoff. This screen will confirm only after its delivery webhook arrives."}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-[1fr_156px] sm:items-center">
                <div>
                  <div className="flex items-center gap-2 text-[#0866ff]">
                    <Smartphone className="h-4 w-4" />
                    <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em]">
                      Phone handoff · Linq
                    </p>
                  </div>
                  <h3 className="mt-2 text-xl font-bold tracking-[-0.02em]">
                    Take this mission into Messages.
                  </h3>
                  <p className="mt-1.5 max-w-md text-xs leading-relaxed text-black/55 dark:text-white/55">
                    Send the prepared code from your phone. That inbound message is your consent and links this exact quote—no new payment session is created.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {messagesHref && (
                      <a
                        href={messagesHref}
                        className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#0866ff] px-4 text-xs font-bold text-white transition-transform active:scale-[0.98]"
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> Open Messages
                      </a>
                    )}
                    {mission.vcfUrl && (
                      <a
                        href={mission.vcfUrl}
                        className="inline-flex min-h-10 items-center gap-2 rounded-full border border-black/15 px-4 text-xs font-bold dark:border-white/20"
                      >
                        <ContactRound className="h-3.5 w-3.5" /> Save OnPoint
                      </a>
                    )}
                  </div>

                  <div className="mt-4 grid gap-2 text-[11px] sm:max-w-md sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => void copy("number", mission.phoneNumber)}
                      className="flex items-center justify-between rounded-xl border border-black/10 bg-white px-3 py-2.5 text-left dark:border-white/10 dark:bg-white/5"
                    >
                      <span>
                        <span className="block text-[8px] font-bold uppercase tracking-wider text-black/40 dark:text-white/40">Message</span>
                        <span className="mt-0.5 block font-mono font-semibold">{mission.phoneNumber}</span>
                      </span>
                      {copied === "number" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => void copy("code", mission.message)}
                      className="flex items-center justify-between rounded-xl border border-black/10 bg-white px-3 py-2.5 text-left dark:border-white/10 dark:bg-white/5"
                    >
                      <span className="min-w-0">
                        <span className="block text-[8px] font-bold uppercase tracking-wider text-black/40 dark:text-white/40">Send this code</span>
                        <span className="mt-0.5 block truncate font-mono font-semibold">{mission.message}</span>
                      </span>
                      {copied === "code" ? <Check className="ml-2 h-3.5 w-3.5 shrink-0" /> : <Copy className="ml-2 h-3.5 w-3.5 shrink-0" />}
                    </button>
                  </div>
                </div>

                <div className="hidden sm:block">
                  <div className="rounded-2xl border border-black/10 bg-white p-2 shadow-[0_12px_40px_rgba(0,0,0,0.08)] dark:border-white/10">
                    {qrDataUrl ? (
                      // Generated locally; the mission code is never sent to a QR service.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={qrDataUrl}
                        alt="QR code to open the mission in Messages"
                        className="aspect-square w-full rounded-xl"
                      />
                    ) : (
                      <div className="flex aspect-square items-center justify-center">
                        <QrCode className="h-7 w-7 text-black/25" />
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-center font-mono text-[8px] font-bold uppercase tracking-wider text-black/40 dark:text-white/40">
                    Scan with your phone
                  </p>
                </div>
              </div>
            )
          ) : null}
        </div>
      )}
    </>
  );
}
