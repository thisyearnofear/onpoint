"use client";

import { useAccount, useChainId } from "wagmi";
import { getChainName, getChainColor, getChainIcon } from "../components/chains";

/**
 * Chain Status Indicator - Shows current chain with visual feedback
 * Follows MODULAR and PERFORMANT principles
 */

export function ChainStatusIndicator() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const chainName = getChainName(chainId);
  const chainColor = getChainColor(chainId);
  const chainIcon = getChainIcon(chainId);

  if (!isConnected) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-muted rounded-full hover:bg-muted/80 transition-colors cursor-pointer" title={`Connected to ${chainName}`}>
      <div className="flex items-center gap-1">
        {chainIcon && (
          <div className={`w-4 h-4 rounded-full ${chainColor} flex items-center justify-center`}>
            <span className="text-white text-xs font-bold">{chainIcon}</span>
          </div>
        )}
        <span className="text-sm font-medium text-muted-foreground">
          {chainName}
        </span>
      </div>
      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
    </div>
  );
}