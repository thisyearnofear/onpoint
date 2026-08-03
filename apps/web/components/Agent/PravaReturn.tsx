"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, Loader2, ShieldCheck } from "lucide-react";

type ReturnState = "checking" | "credential_ready" | "pending" | "invalid";

export function PravaReturn({ orderId }: { orderId: string }) {
  const [state, setState] = useState<ReturnState>(
    orderId ? "checking" : "invalid",
  );

  useEffect(() => {
    if (!orderId) return;

    window.opener?.postMessage(
      { type: "onpoint:prava-return", orderId },
      window.location.origin,
    );

    const controller = new AbortController();
    fetch(`/prava/order/${encodeURIComponent(orderId)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const order = await response.json();
        if (!response.ok) throw new Error(order.error || "Order not found");
        setState(
          [
            "credential_ready",
            "checkout_unknown",
            "sandbox_completed",
            "sandbox_declined",
            "confirmed",
          ].includes(order.state)
            ? "credential_ready"
            : "pending",
        );
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setState("invalid");
      });

    return () => controller.abort();
  }, [orderId]);

  const credentialReady = state === "credential_ready";

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b0d0f] px-5 py-12 text-white">
      <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_20%_20%,rgba(82,214,160,0.18),transparent_32%),radial-gradient(circle_at_80%_75%,rgba(255,255,255,0.08),transparent_28%)]" />
      <section className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.055] shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div className="border-b border-white/10 px-6 py-5">
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.24em] text-emerald-300">
            Prava → OnPoint
          </p>
          <p className="mt-1 text-sm text-white/55">Secure mission handoff</p>
        </div>

        <div className="px-6 py-8 sm:px-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-300/25 bg-emerald-300/10 text-emerald-300">
            {state === "checking" ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : credentialReady ? (
              <Check className="h-6 w-6" />
            ) : (
              <ShieldCheck className="h-6 w-6" />
            )}
          </div>

          <h1 className="mt-6 text-3xl font-black leading-tight tracking-[-0.035em]">
            {state === "checking"
              ? "Handing verification back."
              : credentialReady
                ? "Prava verification complete."
                : state === "invalid"
                  ? "Mission link unavailable."
                  : "Verification received."}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/60">
            {credentialReady
              ? "A successful sandbox credential was generated. This is not a merchant order or charge."
              : state === "invalid"
                ? "Return to the original OnPoint tab to continue or start a new mission."
                : "OnPoint is checking the credential state in the original tab. No merchant purchase is claimed here."}
          </p>

          {orderId && (
            <p className="mt-5 truncate rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-[10px] text-white/40">
              {orderId}
            </p>
          )}

          <button
            type="button"
            onClick={() => window.close()}
            className="mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-black transition-transform active:scale-[0.98]"
          >
            <ArrowLeft className="h-4 w-4" /> Return to the mission
          </button>
          <Link
            href="/#agent-search"
            className="mt-3 block text-center text-xs font-semibold text-white/45 underline-offset-4 hover:text-white hover:underline"
          >
            Open OnPoint in this tab
          </Link>
        </div>
      </section>
    </main>
  );
}
