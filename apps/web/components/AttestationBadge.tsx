"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  ExternalLink,
  Fingerprint,
  ScrollText,
  Loader2,
  X,
} from "lucide-react";

interface AttestationData {
  erc8004: {
    agentId: number;
    name: string;
    walletAddress: string;
    registryAddress: string;
    registrationTxHash: string;
    receiptCount: number;
    registeredAt: string;
    explorerUrl: string;
    registryExplorerUrl: string;
  };
  self: {
    selfAgentId: string;
    status: "pending" | "verified" | "failed";
    attestationHash?: string;
  };
  trust: {
    erc8004Registered: boolean;
    selfVerified: boolean;
    receiptCount: number;
    chain: string;
  };
}

export function AttestationBadge() {
  const [data, setData] = useState<AttestationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadAttestation() {
      try {
        const res = await fetch("/api/agent/attestation");
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        // non-critical
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadAttestation();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (loading) return null;
  if (!data) return null;

  const isVerified = data.trust.erc8004Registered && data.trust.selfVerified;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
          isVerified
            ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/15"
            : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"
        }`}
        title="Agent Identity Attestation"
      >
        {isVerified ? (
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />
        )}
        <span className="hidden sm:inline">
          {isVerified ? "Verified Agent" : "Agent ID"}
        </span>
        <span className="sm:hidden">ID</span>
      </button>

      <AnimatePresence>
        {open && data && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 z-[100] w-80 rounded-xl border border-border bg-card shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck
                  className={`w-5 h-5 ${
                    isVerified ? "text-emerald-400" : "text-muted-foreground"
                  }`}
                />
                <div>
                  <p className="text-sm font-bold text-foreground">
                    {data.erc8004.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Autonomous Agent Identity
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>

            {/* ERC-8004 Registry */}
            <div className="px-4 py-3 border-b border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <ScrollText className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-[11px] font-bold text-foreground">
                  ERC-8004 Registry
                </span>
                <span className="ml-auto bg-emerald-500/15 text-emerald-300 text-[8px] font-bold px-1.5 py-0.5 rounded-full">
                  registered
                </span>
              </div>
              <div className="space-y-1.5 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Agent ID</span>
                  <span className="text-foreground font-mono font-bold">
                    #{data.erc8004.agentId}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Chain</span>
                  <span className="text-foreground">{data.trust.chain}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Receipts</span>
                  <span className="text-foreground">
                    {data.trust.receiptCount} onchain actions
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Wallet</span>
                  <a
                    href={data.erc8004.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-indigo-400 hover:text-indigo-300 transition-colors font-mono"
                  >
                    {data.erc8004.walletAddress.slice(0, 6)}...
                    {data.erc8004.walletAddress.slice(-4)}
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Registry</span>
                  <a
                    href={data.erc8004.registryExplorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-indigo-400 hover:text-indigo-300 transition-colors font-mono"
                  >
                    {data.erc8004.registryAddress.slice(0, 6)}...
                    {data.erc8004.registryAddress.slice(-4)}
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>
            </div>

            {/* Self Protocol */}
            <div className="px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <Fingerprint className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-[11px] font-bold text-foreground">
                  Self Protocol
                </span>
                <span
                  className={`ml-auto text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
                    data.self.status === "verified"
                      ? "bg-emerald-500/15 text-emerald-300"
                      : data.self.status === "pending"
                      ? "bg-amber-500/15 text-amber-300"
                      : "bg-red-500/15 text-red-300"
                  }`}
                >
                  {data.self.status}
                </span>
              </div>
              <div className="space-y-1.5 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Self Agent ID</span>
                  <span className="text-foreground font-mono">
                    {data.self.selfAgentId}
                  </span>
                </div>
                {data.self.attestationHash && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Attestation</span>
                    <span className="text-foreground font-mono truncate max-w-[160px]">
                      {data.self.attestationHash.slice(0, 10)}...
                    </span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
