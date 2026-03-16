"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, 
  Activity, 
  Cpu, 
  Database, 
  Zap, 
  Wifi,
  Terminal as TerminalIcon,
  ChevronRight,
  TrendingUp,
  Award
} from 'lucide-react';
import { Card, CardContent } from '@repo/ui/card';

export function CommandCenter() {
  const [pulse, setPulse] = useState(0);
  const [reasoningText, setReasoningText] = useState("Analyzing global fashion trends...");
  
  useEffect(() => {
    const interval = setInterval(() => {
      setPulse(p => (p + 1) % 100);
    }, 2000);

    const reasonings = [
      "Analyzing global fashion trends...",
      "Syncing with Filecoin/Lighthouse nodes...",
      "Agent Miranda: Expecting excellence today.",
      "Celo Network: Block speed optimized.",
      "Detecting micro-trends in urban streetwear...",
      "Agent Shaft: Keep it smooth, look sharp.",
      "Proof of Style Protocol: Ready for capture."
    ];
    
    let idx = 0;
    const reasonInterval = setInterval(() => {
      idx = (idx + 1) % reasonings.length;
      setReasoningText(reasonings[idx] ?? "");
    }, 4000);

    return () => {
      clearInterval(interval);
      clearInterval(reasonInterval);
    };
  }, []);

  return (
    <div className="w-full space-y-4">
      {/* Tactical Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatusCard 
          icon={<ShieldCheck className="w-4 h-4 text-green-400" />}
          label="Secure Cloud"
          value="Online"
          subValue="Google Vertex AI"
        />
        <StatusCard 
          icon={<Database className="w-4 h-4 text-indigo-400" />}
          label="IPFS Storage"
          value="Syncing"
          subValue="Lighthouse Filecoin"
        />
        <StatusCard 
          icon={<Zap className="w-4 h-4 text-yellow-400" />}
          label="Protocol"
          value="v1.5.Live"
          subValue="Gemini Multimodal"
        />
        <StatusCard 
          icon={<Wifi className="w-4 h-4 text-blue-400" />}
          label="Economy"
          value="Celo"
          subValue="cUSD Active"
        />
      </div>

      {/* Reasoning Terminal Preview */}
      <Card className="bg-card/70 backdrop-blur-xl border-border overflow-hidden shadow-2xl">
        <CardContent className="p-0">
          <div className="bg-muted/60 px-4 py-2 flex items-center justify-between border-b border-border">
            <div className="flex items-center gap-2">
              <TerminalIcon className="w-3 h-3 text-primary" />
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-tighter">AI Reasoning Terminal</span>
            </div>
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500/50" />
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/50" />
              <div className="w-1.5 h-1.5 rounded-full bg-green-500/50" />
            </div>
          </div>
          <div className="p-4 flex items-center gap-3">
             <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
             <AnimatePresence mode="wait">
               <motion.p 
                 key={reasoningText}
                 initial={{ opacity: 0, x: -10 }}
                 animate={{ opacity: 1, x: 0 }}
                 exit={{ opacity: 0, x: 10 }}
                 className="text-xs font-mono text-primary/80"
               >
                 {reasoningText}
               </motion.p>
             </AnimatePresence>
          </div>
        </CardContent>
      </Card>

      {/* Impact Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/10 to-transparent border border-border">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground font-medium">Network Impact</span>
          </div>
          <div className="text-2xl font-bold text-foreground tracking-tighter">14.2k</div>
          <div className="text-[10px] text-green-400 font-mono">+12% vs last check</div>
        </div>
        <div className="p-4 rounded-2xl bg-gradient-to-br from-accent/10 to-transparent border border-border">
          <div className="flex items-center gap-2 mb-1">
            <Award className="w-4 h-4 text-accent" />
            <span className="text-xs text-muted-foreground font-medium">On-Chain Assets</span>
          </div>
          <div className="text-2xl font-bold text-foreground tracking-tighter">852</div>
          <div className="text-[10px] text-accent font-mono">Proofs of Style</div>
        </div>
      </div>
    </div>
  );
}

function StatusCard({ icon, label, value, subValue }: { icon: any, label: string, value: string, subValue: string }) {
  return (
    <div className="p-3 rounded-2xl bg-card/70 border border-border backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{label}</span>
      </div>
      <div className="text-sm font-bold text-foreground tracking-tight leading-none mb-1">{value}</div>
      <div className="text-[9px] text-muted-foreground font-medium">{subValue}</div>
    </div>
  );
}
