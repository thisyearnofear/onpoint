"use client";

import { useState } from "react";
import { Link2, Loader2, Check, X } from "lucide-react";
import { getApiBase } from "../../lib/utils/api-base";
import { agentAuthHeadersFromSession } from "../../lib/agent-session";
import { useAgentSession } from "../../lib/hooks/use-agent-session";

interface CuratorLinkAgentProps {
  curatorSlug: string;
  /** @deprecated no longer used as a credential — kept for prop compat */
  whatsapp?: string;
  currentLinkedAddress: string | null;
}

export function CuratorLinkAgent({
  curatorSlug,
  currentLinkedAddress,
}: CuratorLinkAgentProps) {
  const { session } = useAgentSession();
  const [address, setAddress] = useState(currentLinkedAddress || "");
  const [agentToken, setAgentToken] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"idle" | "code-sent">("idle");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);

  const validAddress = /^0x[a-fA-F0-9]{40}$/.test(address.trim());
  // If the curator is linking their own wallet, the current session token
  // already proves agent-side consent — no paste needed.
  const sessionMatchesAgent =
    !!session &&
    session.address.toLowerCase() === address.trim().toLowerCase();
  const effectiveAgentToken = sessionMatchesAgent ? session.token : agentToken.trim();

  async function handleRequest() {
    if (!session || !validAddress) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(
        `${getApiBase()}/api/looks/curator/${curatorSlug}/link-agent/request`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...agentAuthHeadersFromSession(session, curatorSlug),
          },
          body: JSON.stringify({}),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult({
          ok: false,
          error:
            res.status === 401
              ? "Sign in with the curator payout wallet first."
              : res.status === 403
                ? data.hint || data.error || "This wallet cannot manage linking."
                : res.status === 429
                  ? data.error || "Too many codes — wait an hour."
                  : data.error || "Failed to send link code",
        });
        return;
      }
      setStep("code-sent");
      setResult(null);
    } catch (err) {
      setResult({ ok: false, error: String(err) });
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify() {
    if (!session || !validAddress || otp.trim().length !== 6 || !effectiveAgentToken) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(
        `${getApiBase()}/api/looks/curator/${curatorSlug}/link-agent/verify`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...agentAuthHeadersFromSession(session, curatorSlug),
          },
          body: JSON.stringify({
            otp: otp.trim(),
            agentAddress: address.trim(),
            agentToken: effectiveAgentToken,
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setResult({ ok: true });
        setStep("idle");
        setOtp("");
      } else {
        setResult({
          ok: false,
          error:
            res.status === 401
              ? data.error || "Wrong or expired code."
              : res.status === 403
                ? data.hint || data.error || "Agent consent invalid."
                : data.error || "Failed to link agent",
        });
      }
    } catch (err) {
      setResult({ ok: false, error: String(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-2xl rounded-2xl border border-border bg-muted/20 p-5">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-foreground/60" />
        <h3 className="text-sm font-bold">Link an Agent</h3>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Two-sided consent: sign in with the curator payout wallet, send a one-time
        code to the WhatsApp number on file, then confirm with the agent wallet&apos;s
        own session. Linking your own wallet lets you create looks yourself.
      </p>

      {!session && (
        <p className="mt-3 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs">
          Sign in with the curator payout wallet above to manage linking.
        </p>
      )}

      <div className="mt-3 flex flex-col gap-2">
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="0x… agent wallet"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-foreground/20"
        />
        {step === "idle" ? (
          <button
            type="button"
            onClick={handleRequest}
            disabled={busy || !session || !validAddress}
            className="inline-flex items-center gap-1.5 self-start rounded-lg bg-foreground px-3 py-2 text-xs font-bold text-background transition-colors hover:bg-foreground/90 disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
            Send link code
          </button>
        ) : (
          <>
            <input
              type="text"
              inputMode="numeric"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6-digit code from WhatsApp"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
            {!sessionMatchesAgent && (
              <input
                type="text"
                value={agentToken}
                onChange={(e) => setAgentToken(e.target.value)}
                placeholder="Agent session token (agent signs in and pastes their Bearer token)"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-foreground/20"
              />
            )}
            {sessionMatchesAgent && (
              <p className="text-xs text-muted-foreground">
                Linking your own signed-in wallet — agent consent is automatic.
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleVerify}
                disabled={busy || !session || !validAddress || otp.trim().length !== 6 || !effectiveAgentToken}
                className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-xs font-bold text-background transition-colors hover:bg-foreground/90 disabled:opacity-40"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Confirm link
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("idle");
                  setOtp("");
                  setResult(null);
                }}
                disabled={busy}
                className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-40"
              >
                Back
              </button>
            </div>
          </>
        )}
      </div>

      {result && (
        <div
          className={`mt-2 flex items-center gap-2 rounded-lg p-2 text-xs ${
            result.ok ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-error/10 text-red-700 dark:text-red-400"
          }`}
        >
          {result.ok ? (
            <>
              <Check className="h-3.5 w-3.5 shrink-0" />
              <span>Agent linked! Their looks will appear on your storefront.</span>
            </>
          ) : (
            <>
              <X className="h-3.5 w-3.5 shrink-0" />
              <span>{result.error}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
