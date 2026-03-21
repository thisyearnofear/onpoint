"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId } from "wagmi";
import {
  getChainName,
  getChainColor,
  getChainIcon,
} from "../components/chains";
import { Button } from "@repo/ui/button";
import { ChevronDown, Wallet } from "lucide-react";

/**
 * Enhanced ConnectButton with chain visibility
 * Follows ENHANCEMENT FIRST principle by extending existing RainbowKit component
 */

export function EnhancedConnectButton({
  className = "",
}: {
  className?: string;
}) {
  const chainId = useChainId();
  const currentChainName = getChainName(chainId);
  const chainColor = getChainColor(chainId);
  const chainIcon = getChainIcon(chainId);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <ConnectButton.Custom>
        {({ account, chain, openAccountModal, openChainModal, mounted }) => {
          const ready = mounted;
          const connected = ready && account && chain;

          return (
            <div className="flex items-center gap-2">
              {connected ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="border-primary/20 bg-background/50 hover:bg-primary/10 transition-colors"
                    onClick={openChainModal}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-5 h-5 rounded-full ${chainColor} flex items-center justify-center text-white text-[10px] font-bold`}
                      >
                        {chainIcon}
                      </div>
                      <span className="hidden sm:inline">
                        {currentChainName}
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
                  onClick={() => {
                    const el = document.querySelector(
                      '[role="button"][aria-label="Connect Wallet"]',
                    );
                    if (el instanceof HTMLElement) el.click();
                  }}
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
