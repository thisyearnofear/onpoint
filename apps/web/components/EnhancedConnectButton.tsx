"use client";

import { useEffect, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId, useSignMessage } from "wagmi";
import { useUser } from "@auth0/nextjs-auth0/client";
import { SiweMessage } from "siwe";
import {
  getChainName,
  getChainColor,
  getChainIcon,
} from "../components/chains";
import { Button } from "@repo/ui/button";
import {
  ChevronDown,
  Wallet,
  Trophy,
  AlertCircle,
  Star,
  Link2,
  Coins,
  Gift,
  Sparkles,
} from "lucide-react";
import { MissionService } from "../lib/services/mission-service";
import { useMiniApp } from "@neynar/react";
import { resolveENSAddress, getENSAvatar } from "../lib/utils/ens";
import { celo, celoSepolia } from "../config/chains";
import { useMiniPay } from "../lib/hooks/useMiniPay";

/**
 * Enhanced ConnectButton with chain visibility and Mission Progress
 * Follows ENHANCEMENT FIRST principle by extending existing RainbowKit component
 */

export function EnhancedConnectButton({
  className = "",
}: {
  className?: string;
}) {
  const { address } = useAccount();
  const chainId = useChainId();
  const { context } = useMiniApp();
  const { user } = useUser();
  const { isMiniPay } = useMiniPay();
  const { signMessageAsync } = useSignMessage();
  // Resolve primary ENS name + avatar by calling ensdata.net directly.
  // wagmi's built-in useEnsName uses the eth.merkle.io path which we have
  // blocked at the fetch layer, so it never returned a name. The
  // ensdata.net API supports address → name lookups against the public ENS
  // registry with no CORS issues, and works for any wallet connected on any
  // chain (Celo included) since ENS lives on Ethereum mainnet regardless.
  const [ensName, setEnsName] = useState<string | null>(null);
  const [ensAvatar, setEnsAvatar] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setEnsName(null);
    setEnsAvatar(null);
    if (!address) return;
    (async () => {
      try {
        const name = await resolveENSAddress(address);
        if (cancelled) return;
        setEnsName(name);
        if (name) {
          const avatar = await getENSAvatar(name);
          if (cancelled) return;
          setEnsAvatar(avatar);
        }
      } catch {
        // Non-fatal — wallet still works, just shows truncated address
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);
  const [walletLinked, setWalletLinked] = useState(false);
  const [linkingWallet, setLinkingWallet] = useState(false);
  const [showValueProp, setShowValueProp] = useState(false);

  useEffect(() => {
    setWalletLinked(false);
  }, [address, user?.sub]);

  const linkWallet = async () => {
    if (!address || !user?.sub || linkingWallet) return;

    setLinkingWallet(true);
    try {
      const nonceResponse = await fetch("/api/auth/nonce");
      if (!nonceResponse.ok) throw new Error("Failed to create wallet nonce");

      const { nonce } = await nonceResponse.json();
      const issuedAt = new Date();
      const expirationTime = new Date(issuedAt.getTime() + 10 * 60 * 1000);
      const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement: "Link this wallet to your OnPoint account.",
        uri: window.location.origin,
        version: "1",
        chainId,
        nonce,
        issuedAt: issuedAt.toISOString(),
        expirationTime: expirationTime.toISOString(),
      }).prepareMessage();

      const signature = await signMessageAsync({ message });
      const linkResponse = await fetch("/api/auth/link-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, signature }),
      });

      if (!linkResponse.ok) {
        const payload = await linkResponse.json().catch(() => null);
        throw new Error(payload?.error || "Failed to link wallet");
      }

      setWalletLinked(true);
    } catch (error) {
      console.error("Failed to link wallet:", error);
    } finally {
      setLinkingWallet(false);
    }
  };

  const currentChainName = getChainName(chainId);
  const chainColor = getChainColor(chainId);
  const chainIcon = getChainIcon(chainId);

  // Mission Context
  const xp = address ? MissionService.getUserXp(address) : 0;
  const badges = address ? MissionService.getUserBadges(address) : [];
  const level = Math.floor(xp / 100) + 1;
  const isStyleElite = badges.includes("style-elite");

  // Celo-First Logic
  const isCelo = chainId === celo.id || chainId === celoSepolia.id;
  const inMiniApp = !!context?.client;
  const showCeloWarning = inMiniApp && !isCelo;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <ConnectButton.Custom>
        {({
          account,
          chain,
          openAccountModal,
          openChainModal,
          openConnectModal,
          mounted,
        }) => {
          const ready = mounted;
          const connected = ready && account && chain;

          // Hide connect button when in MiniPay (auto-connected)
          if (isMiniPay && !connected) {
            return null;
          }

          return (
            <div className="flex items-center gap-2">
              {connected ? (
                <div className="flex items-center gap-2">
                  {/* Mission/Level Badge */}
                  <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-full">
                    <Trophy className="h-3 w-3 text-primary" />
                    <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                      Lvl {level}
                    </span>
                    {isStyleElite && (
                      <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                    )}
                  </div>

                  <Button
                    variant="outline"
                    className={`border-primary/20 bg-background/50 hover:bg-primary/10 transition-colors ${showCeloWarning ? "border-yellow-500/50 animate-pulse" : ""}`}
                    onClick={openChainModal}
                  >
                    <div className="flex items-center gap-2">
                      {showCeloWarning ? (
                        <AlertCircle className="h-4 w-4 text-yellow-500" />
                      ) : (
                        <div
                          className={`w-5 h-5 rounded-full ${chainColor} flex items-center justify-center text-white text-[10px] font-bold`}
                        >
                          {chainIcon}
                        </div>
                      )}
                      <span className="hidden sm:inline">
                        {showCeloWarning ? "Switch to Celo" : currentChainName}
                      </span>
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={openAccountModal}
                    className="border-primary/20 bg-background/50 hover:bg-primary/10 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {ensAvatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={ensAvatar}
                          alt={ensName ?? "ENS avatar"}
                          className="h-5 w-5 rounded-full"
                        />
                      ) : (
                        <Wallet className="h-4 w-4 text-primary" />
                      )}
                      <span>{ensName ?? account.displayName}</span>
                    </div>
                  </Button>

                  {user?.sub && !walletLinked && (
                    <Button
                      variant="outline"
                      onClick={linkWallet}
                      disabled={linkingWallet}
                      className="border-primary/20 bg-background/50 hover:bg-primary/10 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Link2 className="h-4 w-4 text-primary" />
                        <span className="hidden sm:inline">
                          {linkingWallet ? "Linking" : "Link Account"}
                        </span>
                      </div>
                    </Button>
                  )}
                </div>
              ) : (
                <div
                  className="relative"
                  onMouseEnter={() => setShowValueProp(true)}
                  onMouseLeave={() => setShowValueProp(false)}
                >
                  <Button
                    variant="outline"
                    className="border-primary/50 bg-primary/10 hover:bg-primary/20 text-primary transition-all active:scale-95"
                    onClick={openConnectModal}
                  >
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4" />
                      <span>Connect Wallet</span>
                    </div>
                  </Button>
                  {showValueProp && (
                    <div className="absolute top-full right-0 mt-2 w-64 bg-card border border-border rounded-2xl shadow-xl p-4 z-50 animate-fade-in">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
                        Why connect?
                      </p>
                      <div className="space-y-2.5">
                        <div className="flex items-start gap-2">
                          <Gift className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                          <p className="text-xs text-foreground/80">
                            Claim <span className="font-bold">free G$ UBI</span> daily
                          </p>
                        </div>
                        <div className="flex items-start gap-2">
                          <Coins className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                          <p className="text-xs text-foreground/80">
                            <span className="font-bold">Tip your stylist</span> in cUSD or G$
                          </p>
                        </div>
                        <div className="flex items-start gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-400 mt-0.5 shrink-0" />
                          <p className="text-xs text-foreground/80">
                            <span className="font-bold">Mint Proof of Style</span> NFTs
                          </p>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground/50 mt-3 pt-2 border-t border-border/50">
                        On Celo · No gas fees for claiming
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        }}
      </ConnectButton.Custom>
    </div>
  );
}
