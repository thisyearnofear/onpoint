"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Store,
  Plus,
  X,
  Loader2,
  Globe,
} from "lucide-react";

export function MerchantAllowlist() {
  const [merchants, setMerchants] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [input, setInput] = useState("");
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadMerchants() {
      setLoading(true);
      try {
        const res = await fetch("/api/agent/allowlist");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setMerchants(data.merchants || []);
        setAvailable(data.available !== false);
      } catch {
        // endpoint may not be available
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadMerchants();
    return () => { cancelled = true; };
  }, []);

  const addMerchant = async () => {
    const value = input.trim().toLowerCase();
    if (!value) return;
    setAdding(true);
    try {
      const res = await fetch("/api/agent/allowlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchant: value }),
      });
      if (res.ok) {
        const data = await res.json();
        setMerchants(data.merchants || []);
        setInput("");
      }
    } catch {
      // ignore
    } finally {
      setAdding(false);
    }
  };

  const removeMerchant = async (merchant: string) => {
    try {
      const res = await fetch(
        `/api/agent/allowlist?merchant=${encodeURIComponent(merchant)}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        const data = await res.json();
        setMerchants(data.merchants || []);
      }
    } catch {
      // ignore
    }
  };

  if (!available) return null;

  return (
    <div className="mx-4 mb-3">
      <div className="rounded-xl border border-sky-500/20 bg-sky-950/10 p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/15">
              <Store className="h-4 w-4 text-sky-300" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">
                Trusted Merchants
              </p>
              <p className="text-[10px] text-muted-foreground">
                {merchants.length > 0
                  ? `${merchants.length} approved store${merchants.length > 1 ? "s" : ""}`
                  : "Auto-buy from approved stores only"}
              </p>
            </div>
          </div>
          {loading && (
            <Loader2 className="h-3.5 w-3.5 text-sky-300 animate-spin" />
          )}
        </div>

        {/* Merchant list */}
        {merchants.length > 0 && (
          <div className="space-y-1 mb-3">
            <AnimatePresence>
              {merchants.map((merchant) => (
                <motion.div
                  key={merchant}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10, height: 0 }}
                  className="flex items-center gap-2 rounded-lg bg-background/35 px-2.5 py-1.5"
                >
                  <Globe className="h-3 w-3 text-sky-400 flex-shrink-0" />
                  <span className="text-[11px] text-foreground flex-1 truncate">
                    {merchant}
                  </span>
                  <button
                    onClick={() => removeMerchant(merchant)}
                    className="p-0.5 hover:bg-muted rounded transition-colors flex-shrink-0"
                  >
                    <X className="h-3 w-3 text-muted-foreground hover:text-red-400" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Add merchant input */}
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !adding) addMerchant();
            }}
            placeholder="e.g. grailed.com"
            disabled={adding}
            className="flex-1 bg-muted/30 border border-border/50 rounded-lg px-2.5 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-sky-500/30 disabled:opacity-50"
          />
          <button
            onClick={addMerchant}
            disabled={adding || !input.trim()}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-sky-500/20 text-sky-300 rounded-lg border border-sky-500/30 hover:bg-sky-500/30 transition-colors disabled:opacity-50 text-[10px] font-medium"
          >
            {adding ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <Plus className="h-3 w-3" />
                Add
              </>
            )}
          </button>
        </div>

        {merchants.length === 0 && !loading && (
          <p className="text-[9px] text-muted-foreground mt-2">
            The agent will only auto-purchase from merchants on this list.
            Purchases from other stores require your approval.
          </p>
        )}
      </div>
    </div>
  );
}
