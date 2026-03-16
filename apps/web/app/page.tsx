import React from "react";
import { Palette } from "lucide-react";
import { EnhancedConnectButton, ChainStatusIndicator } from "../components/chains";
import { FarcasterSignInButton } from "../components/FarcasterSignInButton";
import { TacticalDashboard } from "../components/Dashboard/TacticalDashboard";
import { ThemeToggle } from "../components/ThemeToggle";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/20">
              <Palette className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tighter bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
              BeOnPoint
              <span className="ml-1 text-[10px] text-primary align-top uppercase tracking-widest opacity-80">Agent</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <FarcasterSignInButton />
            <ChainStatusIndicator />
            <EnhancedConnectButton />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main>
        <TacticalDashboard />
      </main>

      {/* Global Terminal Footer (Minimalist) */}
      <footer className="border-t border-border/60 py-4 bg-background/80">
        <div className="container mx-auto px-4 flex justify-between items-center text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
          <div>Ref: ONPOINT_PROTOCOL_V1.5</div>
          <div>Status: Fully Operational</div>
        </div>
      </footer>
    </div>
  );
}
