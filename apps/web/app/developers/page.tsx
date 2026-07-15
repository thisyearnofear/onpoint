"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Bot,
  Camera,
  Check,
  Code,
  Copy,
  ExternalLink,
  Globe,
  Image as ImageIcon,
  Key,
  Layers,
  Shield,
  Wallet,
  Zap,
} from "lucide-react";
import { OnPointHeader, OnPointFooter } from "../../components/OnPointHeader";
import { getApiBase } from "../../lib/utils/api-base";

const API_BASE = getApiBase();

function Endpoint({ method, path, desc }: { method: string; path: string; desc: string }) {
  const colors: Record<string, string> = {
    GET: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    POST: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  };
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/30 last:border-0">
      <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${colors[method] || "bg-muted text-muted-foreground"}`}>
        {method}
      </span>
      <code className="text-sm font-mono text-foreground break-all">{path}</code>
      <span className="text-sm text-muted-foreground ml-auto shrink-0 text-right max-w-[40%]">{desc}</span>
    </div>
  );
}

function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="rounded-lg border border-border/40 bg-muted/30 overflow-hidden">
      {label && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/30 bg-muted/40">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
          <button onClick={handleCopy} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
      <pre className="p-4 text-xs leading-relaxed overflow-x-auto">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function DevelopersPage() {
  return (
    <div className="min-h-screen bg-background">
      <OnPointHeader />

      <main className="container mx-auto px-4 py-12 md:py-16 max-w-5xl">
        {/* Hero */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-primary uppercase tracking-wider mb-4">
            <Bot className="w-3.5 h-3.5" />
            Agent Commerce API
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight">
            Same catalog.
            <span className="block text-primary">Your agent, your logic.</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            OnPoint exposes a machine-readable API for AI agents. Browse curators, try on items, and buy from the same inventory humans use. Pay with cUSD or gasless USDC.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a
              href="https://beonpoint.netlify.app/.well-known/agent.json"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary/90"
            >
              <Code className="w-4 h-4" />
              agent.json
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="https://beonpoint.netlify.app/openapi.json"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-bold transition-colors hover:bg-card"
            >
              <Code className="w-4 h-4" />
              OpenAPI
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="https://github.com/thisyearnofear/onpoint/blob/master/docs/guides/agent-commerce.md"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-bold transition-colors hover:bg-card"
            >
              <Globe className="w-4 h-4" />
              GitHub Guide
              <ExternalLink className="w-3 h-3" />
            </a>
            <Link
              href="/agent"
              className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-bold transition-colors hover:bg-card"
            >
              <Shield className="w-4 h-4" />
              Public proof
            </Link>
          </div>
        </div>

        {/* Endpoints */}
        <section className="mb-14">
          <h2 className="text-2xl font-black tracking-tight mb-6 flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            API Endpoints
          </h2>
          <div className="rounded-xl border border-border/40 bg-card p-6 space-y-1">
            <Endpoint method="GET" path="/api/curator/directory?agentPurchasable=1" desc="Curators with wallets + physical SKUs" />
            <Endpoint method="GET" path="/api/curator/{slug}/storefront" desc="Listings with cUSD offers" />
            <Endpoint method="POST" path="/api/agent/try-on" desc="Pay to render, get fit signal" />
            <Endpoint method="POST" path="/api/curator/{slug}/order" desc="Buy an item" />
            <Endpoint method="GET" path="/api/curator/{slug}/earnings" desc="Public reconciled ledger" />
            <Endpoint method="POST" path="/api/agent/mint" desc="Mint NFT with royalty split" />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Base URL: <code className="font-mono">{API_BASE}</code>. All responses include x402 payment requirements when auth is needed.
          </p>
        </section>

        <section className="mb-14">
          <h2 className="text-2xl font-black tracking-tight mb-6 flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Verify Before You Pay
          </h2>
          <div className="grid gap-4 md:grid-cols-[1.4fr_1fr] md:items-center">
            <CodeBlock
              label="Read-only inventory check"
              code={`curl -sS '${API_BASE}/api/curator/directory?agentPurchasable=1'`}
            />
            <div className="rounded-lg border border-border/40 bg-card p-5 text-sm leading-6 text-muted-foreground">
              Discover stocked curator storefronts without credentials. Select an offer,
              request a 402 challenge, and only then create a payment authorization.
            </div>
          </div>
        </section>

        {/* Payment Flow */}
        <section className="mb-14">
          <h2 className="text-2xl font-black tracking-tight mb-6 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Two Payment Paths
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {/* cUSD path */}
            <div className="rounded-xl border border-border/40 bg-gradient-to-br from-background to-primary/[0.03] p-6 space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Wallet className="w-4 h-4 text-primary" />
                </div>
                <h3 className="font-bold">cUSD Direct</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Standard cUSD transfer on Celo. Append the attribution dataSuffix to the tx data.
              </p>
              <ol className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">1</span>
                  <span>POST try-on or order</span>
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">2</span>
                  <span>Receive 402 with payTo + dataSuffix</span>
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">3</span>
                  <span>Transfer cUSD, re-POST with txHash</span>
                </li>
              </ol>
              <div className="pt-3 border-t border-border/30 text-xs text-muted-foreground">
                Token: cUSD (Mento StableTokenV2) on Celo
              </div>
            </div>

            {/* USDC facilitator path */}
            <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-br from-background to-primary/[0.04] p-6 space-y-4 relative">
              <div className="absolute -top-3 right-4 px-3 py-0.5 rounded-full bg-primary text-white text-xs font-bold">
                Recommended
              </div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Zap className="w-4 h-4 text-primary" />
                </div>
                <h3 className="font-bold">USDC via Facilitator</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Gasless for buyer. Sign EIP-3009 auth, facilitator settles on-chain.
              </p>
              <ol className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">1</span>
                  <span>Sign EIP-3009 transferWithAuthorization</span>
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">2</span>
                  <span>Encode PaymentPayload as base64 JSON</span>
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">3</span>
                  <span>Send in X-PAYMENT header</span>
                </li>
              </ol>
              <div className="pt-3 border-t border-border/30 text-xs text-muted-foreground">
                Facilitator: api.x402.celo.org. Tokens: USDC, USDT.
              </div>
            </div>
          </div>
        </section>

        {/* Code Example */}
        <section className="mb-14">
          <h2 className="text-2xl font-black tracking-tight mb-6 flex items-center gap-2">
            <Code className="w-5 h-5 text-primary" />
            Quick Start
          </h2>
          <CodeBlock
            label="Request an order quote"
            code={`// 1. Read a live storefront
const store = await fetch("${API_BASE}/api/curator/wanja/storefront")
  .then((response) => response.json());

const listing = store.listings.find(
  (item) => item.agentCommerce?.offers?.length,
);
const offer = listing.agentCommerce.offers[0];

// 2. Request an order quote. No payment happens here.
const orderRes = await fetch(
  "${API_BASE}/api/curator/wanja/order",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      listingId: listing.id,
      size: offer.size,
      quantity: 1,
    }),
  }
);
const challenge = await orderRes.json();

if (orderRes.status !== 402) throw new Error("Expected a payment challenge");
// challenge.quote and challenge.x402 now describe cUSD and gasless USDC paths.`}
          />
        </section>

        {/* Capabilities */}
        <section className="mb-14">
          <h2 className="text-2xl font-black tracking-tight mb-6 flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Platform Capabilities
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                icon: <Camera className="w-5 h-5" />,
                title: "Virtual Try-On",
                desc: "AI renders items on buyer's photo. Fit signal + critique. Digital curators use Venice API.",
              },
              {
                icon: <ImageIcon className="w-5 h-5" />,
                title: "Digital Fashion",
                desc: "AI curators generate designs. NFT minting with 85/15 royalty split via 0xSplits.",
              },
              {
                icon: <Key className="w-5 h-5" />,
                title: "Attribution",
                desc: "ERC-8021 dataSuffix on every tx. Dual tags for hackathon credit. Agent codes supported.",
              },
            ].map((cap) => (
              <div key={cap.title} className="rounded-xl border border-border/40 bg-card p-5 space-y-3">
                <div className="flex items-center gap-2 text-primary">
                  {cap.icon}
                  <h3 className="text-sm font-bold">{cap.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{cap.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Agent Identity */}
        <section className="mb-14">
          <h2 className="text-2xl font-black tracking-tight mb-6 flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            Agent Identity
          </h2>
          <div className="rounded-xl border border-border/40 bg-card p-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  OnPoint AI Stylist
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ERC-8004 ID</span>
                    <code className="font-mono">9177</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Wallet</span>
                    <code className="font-mono text-xs">0x5b33...24fB</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Chain</span>
                    <span>Celo (42220)</span>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Registry
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Contract</span>
                    <code className="font-mono text-xs">0x8004...a432</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Self verification</span>
                    <span>Not published</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <div className="text-center">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:text-primary/80 transition-colors"
          >
            See pricing details
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>

      <OnPointFooter />
    </div>
  );
}
