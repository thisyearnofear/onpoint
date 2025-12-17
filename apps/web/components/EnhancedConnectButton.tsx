"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId } from "wagmi";
import { getChainName, getChainColor, getChainIcon } from "../components/chains";
import { Button } from "@repo/ui/button";
import { ChevronDown, Wallet } from "lucide-react";

/**
 * Enhanced ConnectButton with chain visibility
 * Follows ENHANCEMENT FIRST principle by extending existing RainbowKit component
 */

export function EnhancedConnectButton({ 
  showBalance = false,
  chainStatus = "icon",
  className = ""
}: {
  showBalance?: boolean;
  chainStatus?: "icon" | "name" | "none";
  className?: string;
}) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const currentChainName = getChainName(chainId);
  const chainColor = getChainColor(chainId);
  const chainIcon = getChainIcon(chainId);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <ConnectButton 
        showBalance={showBalance} 
        chainStatus={chainStatus}
      >
        {({ account, chain, openAccountModal, openChainModal, mounted }) => {
          const ready = mounted;
          const connected = ready && account && chain;

          return (
            <div className="flex items-center gap-2">
              {connected ? (
                <Button 
                  variant="outline" 
                  className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                  onClick={openChainModal}
                >
                  <div className="flex items-center gap-2">
                    {chainIcon && (
                      <div className={`w-5 h-5 rounded-full ${chainColor} flex items-center justify-center text-white text-xs font-bold`}>
                        {chainIcon}
                      </div>
                    )}
                    <span className="hidden sm:inline">{currentChainName}</span>
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </Button>
              ) : (
                <Button 
                  variant="outline" 
                  className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
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
      </ConnectButton>
    </div>
  );
}