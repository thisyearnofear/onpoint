"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { ChevronRight } from "lucide-react";
import { TryOnPanel } from "./TryOnPanel";
import { NewUserOnboarding } from "./NewUserOnboarding";

const PanelLoading = () => (
  <div className="flex min-h-[30vh] items-center justify-center" role="status">
    <span className="text-xs font-semibold text-muted-foreground">Loading panel…</span>
  </div>
);
const StylistPanel = dynamic(() => import("./StylistPanel").then((m) => m.StylistPanel), { loading: PanelLoading });
const MyLooksPanel = dynamic(() => import("./MyLooksPanel").then((m) => m.MyLooksPanel), { loading: PanelLoading });
const SettingsPanel = dynamic(() => import("./SettingsPanel").then((m) => m.SettingsPanel), { loading: PanelLoading });

// Secondary surfaces are disclosures on this page, not tabs. ?tab= opens one
// and leaves — a tab was a request to see something, never a place to bookmark.
const TAB_TO_PANEL: Record<string, string> = {
  "my-looks": "your-try-ons",
  saved: "your-try-ons",
  stylist: "ask-stylist",
  settings: "settings",
};

const PANEL_IDS = ["your-try-ons", "ask-stylist", "settings"];

interface DeepLinkContext {
  from?: string;
  item?: string;
  persona?: string;
}

function panelForTab(value: string | null | undefined): string | undefined {
  return value && Object.hasOwn(TAB_TO_PANEL, value) ? TAB_TO_PANEL[value] : undefined;
}

/** A hash names the panel directly — that is what the retired-mode 301s land on. */
function panelForHash(value: string): string | undefined {
  return PANEL_IDS.includes(value) ? value : undefined;
}

export function TacticalDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  // Derived, not stored: setting a fresh object here on every URL read
  // re-renders, which re-runs the effect below, which sets it again.
  const deepLinkContext = useMemo<DeepLinkContext | null>(() => {
    const from = searchParams.get("from") || undefined;
    const item = searchParams.get("item") || undefined;
    const persona = searchParams.get("persona") || undefined;
    return from || item || persona ? { from, item, persona } : null;
  }, [searchParams]);

  useEffect(() => {
    const tab = searchParams.get("tab");

    // The shop verb has one home: /shop. Old ?tab=shop links forward there.
    if (tab === "shop") {
      const item = searchParams.get("item");
      router.replace(`/shop${item ? `?item=${encodeURIComponent(item)}` : ""}`);
      return;
    }

    // Drop the tab, keep the hash the retired-mode 301 aimed at, and keep what
    // the panels read — the fitting room resolves its garment from ?item=
    // after the render lands, and the similar-items fetch asks for it off the URL.
    const requested = panelForTab(tab) || panelForHash(window.location.hash.slice(1));
    const rest = new URLSearchParams(searchParams.toString());
    rest.delete("tab");
    const query = rest.toString();
    const path = query
      ? `${window.location.pathname}?${query}`
      : window.location.pathname;
    window.history.replaceState(null, "", `${path}${window.location.hash}`);

    if (requested) openPanel(requested);
  }, [searchParams, router]);

  // Dismissal belongs to the hand-off it was for: a new ?from=&item= is a
  // different hand-off and earns its own banner.
  const handoffKey = deepLinkContext
    ? `${deepLinkContext.from ?? ""}|${deepLinkContext.item ?? ""}|${deepLinkContext.persona ?? ""}`
    : null;
  const context = handoffKey && handoffKey === dismissedKey ? null : deepLinkContext;

  return (
    <>
      {!context && <NewUserOnboarding />}
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-6 pb-24 md:py-8 md:pb-8">
          <div id="fitting-room">
            <TryOnPanel
              deepLinkFrom={context?.from}
              deepLinkItem={context?.item}
              deepLinkPersona={context?.persona}
              onDismissDeepLink={() => setDismissedKey(handoffKey)}
            />
          </div>

          <div className="mt-8 space-y-3">
            <Panel id="your-try-ons" title="Your try-ons" hint="Every render you kept, with its scores and share cards.">
              <MyLooksPanel onBackToTryOn={() => scrollToFittingRoom()} />
            </Panel>
            <Panel id="ask-stylist" title="Ask a stylist" hint="A conversation with your style profile already in it.">
              <StylistPanel />
            </Panel>
            <Panel id="settings" title="Settings" hint="Wallet, connected accounts, and the accounts this app signs you into.">
              <SettingsPanel />
            </Panel>
          </div>
        </main>
      </div>
    </>
  );
}

function Panel({
  id,
  title,
  hint,
  children,
}: {
  id: string;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <details id={id} className="group scroll-mt-24 overflow-hidden rounded-2xl border border-border bg-card/40">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 hover:bg-muted/30 transition-colors">
        <div className="min-w-0">
          <p className="text-sm font-bold uppercase tracking-wider text-foreground">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        </div>
        <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
      </summary>
      <div className="border-t border-border px-4 py-4">{children}</div>
    </details>
  );
}

function openPanel(id: string) {
  const panel = document.getElementById(id) as HTMLDetailsElement | null;
  if (!panel) return;
  panel.open = true;
  panel.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
}

function scrollToFittingRoom() {
  const room = document.getElementById("fitting-room");
  if (!room) return;
  room.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
