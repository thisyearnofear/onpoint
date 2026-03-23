"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId } from "wagmi";
import {
  getChainName,
  getChainColor,
  getChainIcon,
} from "../components/chains";
import { Button } from "@repo/ui/button";
import { ChevronDown, Wallet, Trophy, AlertCircle, Star } from "lucide-react";
import { MissionService } from "../lib/services/mission-service";
import { useMiniApp } from "@neynar/react";
import { celo, celoSepolia } from "../config/chains";

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
