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
} from "lucide-react";
import { MissionService } from "../lib/services/mission-service";
import { useMiniApp } from "@neynar/react";
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
  const [walletLinked, setWalletLinked] = useState(false);
  const [linkingWallet, setLinkingWallet] = useState(false);

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
                      <Wallet className="h-4 w-4 text-primary" />
                      <span>{account.displayName}</span>
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
              )}
            </div>
          );
        }}
      </ConnectButton.Custom>
    </div>
  );
}
