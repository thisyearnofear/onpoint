"use client";

import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useSignMessage } from "wagmi";
import { Loader2, Wallet, LogOut, ShieldCheck } from "lucide-react";
import { useAgentSession } from "../../lib/hooks/use-agent-session";

/**
 * Wallet-gated sign-in for curator look tools.
 *
 * The looks API requires a signature-verified session (Bearer token from
 * POST /api/auth/verify) for all writes. This component connects a wallet,
 * signs the SIWE-style challenge off-chain (no gas), and persists the token
 * in sessionStorage for CuratorLookCreator / CuratorHomePanel.
 */
export function CuratorWalletAuth({
  curatorSlug,
  compact = false,
}: {
  curatorSlug: string;
  compact?: boolean;
}) {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { session, signIn, signOut } = useAgentSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signedAddress = session?.address?.toLowerCase() ?? null;
  const connectedAddress = address?.toLowerCase() ?? null;
  const signedForCurrentWallet = Boolean(signedAddress && connectedAddress && signedAddress === connectedAddress);

  async function handleSignIn() {
    if (!address) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(address, (args) => signMessageAsync(args));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (session && (!connectedAddress || signedForCurrentWallet)) {
    return (
      <div
        className={`flex flex-wrap items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-xs ${compact ? "" : "mb-1"}`}
      >
        <ShieldCheck className="h-3.5 w-3.5 text-success" />
        <span className="font-mono">
          Signed in as {session.address.slice(0, 6)}…{session.address.slice(-4)}
        </span>
        <span className="text-muted-foreground">
          for {curatorSlug} · look writes enabled
        </span>
        <button
          type="button"
          onClick={signOut}
          className="ml-auto inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-3 w-3" />
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium">
          {session
            ? `Session is for ${signedAddress?.slice(0, 6)}…${signedAddress?.slice(-4)} — sign with the connected wallet to switch.`
            : "Look publishing now requires a wallet signature (one tap, no gas)."}
        </span>
        <span className="ml-auto flex items-center gap-2">
          {!isConnected ? (
            <ConnectButton.Custom>
              {({ openConnectModal, mounted }) => (
                <button
                  type="button"
                  disabled={!mounted}
                  onClick={openConnectModal}
                  className="rounded-lg bg-foreground px-2.5 py-1.5 font-bold text-background hover:bg-foreground/90 disabled:opacity-40"
                >
                  Connect wallet
                </button>
              )}
            </ConnectButton.Custom>
          ) : (
            <button
              type="button"
              onClick={handleSignIn}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-2.5 py-1.5 font-bold text-background hover:bg-foreground/90 disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
              {busy ? "Signing…" : "Sign in with wallet"}
            </button>
          )}
        </span>
      </div>
      {error && <p className="mt-1.5 text-red-700 dark:text-red-400">{error}</p>}
      <p className="mt-1.5 text-muted-foreground">
        Use the curator payout wallet or the linked agent wallet — other wallets get a
        403 linking error. The message you sign never authorizes a payment.
      </p>
    </div>
  );
}
