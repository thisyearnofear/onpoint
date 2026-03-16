"use client";

import React, { useState } from 'react';
import { Button } from '@repo/ui/button';
import { useAccount, useChainId, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi';
import { parseEther } from 'viem';
import { Coins, Loader2, CheckCircle2 } from 'lucide-react';
import { celo, celoAlfajores } from '../../config/chains';

const CUSD_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

// The "Stylist Agent" address that receives the tips
const STYLIST_AGENT_ADDRESS = '0xdb65806c994C3f55079a6136a8E0886CbB2B64B1'; 

export function CeloTipButton() {
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const { switchChain } = useSwitchChain();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const [amount] = useState('0.1'); // Fixed tip amount for demo simplicity

  const isOnCelo = chainId === celo.id || chainId === celoAlfajores.id;
  const cUSDAddress = chainId === celo.id 
    ? celo.contracts.cUSD.address 
    : celoAlfajores.contracts.cUSD.address;

  const handleTip = async () => {
    if (!isConnected) return;
    
    if (!isOnCelo) {
      switchChain({ chainId: celoAlfajores.id });
      return;
    }

    try {
      writeContract({
        address: cUSDAddress as `0x${string}`,
        abi: CUSD_ABI,
        functionName: 'transfer',
        args: [
          STYLIST_AGENT_ADDRESS as `0x${string}`,
          parseEther(amount),
        ],
      });
    } catch (err) {
      console.error('Tip failed:', err);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-300 rounded-full border border-green-500/30 animate-in fade-in zoom-in duration-300">
        <CheckCircle2 className="w-4 h-4" />
        <span className="text-sm font-bold">Tipped {amount} cUSD!</span>
      </div>
    );
  }

  return (
    <Button
      onClick={handleTip}
      disabled={isPending || isConfirming}
      variant="outline"
      className="rounded-full flex items-center gap-2 bg-black/40 backdrop-blur-xl border border-white/10 hover:bg-primary/20 hover:border-primary/40 transition-all active:scale-95"
    >
      {isPending || isConfirming ? (
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
      ) : (
        <Coins className="w-4 h-4 text-primary" />
      )}
      <span className="text-sm font-bold text-white">
        {!isOnCelo ? 'Switch to Celo to Tip' : `Tip Stylist ${amount} cUSD`}
      </span>
      {error && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1 bg-red-500 text-white text-[10px] rounded shadow-lg whitespace-nowrap">
          {error.message.includes('User rejected') ? 'Transaction Canceled' : 'Insufficient cUSD'}
        </div>
      )}
    </Button>
  );
}
