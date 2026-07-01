"use client";

import React, { useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Globe,
  Loader2,
  MessageCircle,
  Palette,
  Sparkles,
  Store,
  X,
  AlertCircle,
  ShoppingBag,
  Smartphone,
  Share2,
  Gift,
  ChevronDown,
  CheckCircle,
} from "lucide-react";
import { getApiBase } from "../../../lib/utils/api-base";
import { GClaimCTA } from "../../../components/Curator/GClaimCTA";

// ── Valid verticals (mirrors server-side list) ──────────────

const VERTICALS = [
  { id: "football", label: "Football", emoji: "⚽" },
  { id: "sportswear", label: "Sportswear", emoji: "🏃" },
  { id: "premier-league", label: "Premier League", emoji: "🏆" },
  { id: "streetwear", label: "Streetwear", emoji: "👟" },
  { id: "sneakers", label: "Sneakers", emoji: "👟" },
  { id: "formal", label: "Formal", emoji: "👔" },
  { id: "occasion", label: "Occasion", emoji: "🎀" },
  { id: "sustainable", label: "Sustainable", emoji: "🌱" },
  { id: "outdoor", label: "Outdoor", emoji: "🏔️" },
  { id: "high-fashion", label: "High Fashion", emoji: "👗" },
  { id: "runway", label: "Runway", emoji: "✨" },
  { id: "luxury", label: "Luxury", emoji: "💎" },
  { id: "retro", label: "Retro", emoji: "📼" },
  { id: "tailoring", label: "Tailoring", emoji: "✂️" },
  { id: "ankara", label: "Ankara", emoji: "🧵" },
  { id: "african-print", label: "African Print", emoji: "🌍" },
  { id: "vintage", label: "Vintage", emoji: "📻" },
  { id: "thrift", label: "Thrift", emoji: "🛍️" },
  { id: "hair", label: "Hair", emoji: "💇" },
  { id: "barber", label: "Barber", emoji: "💈" },
  { id: "accessories", label: "Accessories", emoji: "⌚" },
  { id: "jewelry", label: "Jewelry", emoji: "💍" },
];

// ── Types ──────────────────────────────────────────────────

type FormData = {
  slug: string;
  name: string;
  whatsapp: string;
  verticals: string[];
  brandPrimary: string;
  brandAccent: string;
};

type FormErrors = Partial<Record<keyof FormData | "submit", string>>;

type SubmitState = "idle" | "submitting" | "success" | "error";

// ── Validation ─────────────────────────────────────────────

function validate(data: FormData): FormErrors {
  const errors: FormErrors = {};

  if (!data.slug) {
    errors.slug = "Storefront slug is required";
  } else if (!/^[a-z0-9-]{2,48}$/.test(data.slug)) {
    errors.slug = "2–48 chars, lowercase letters, numbers, and hyphens only";
  }

  if (!data.name) {
    errors.name = "Your name is required";
  } else if (data.name.length > 100) {
    errors.name = "Must be 100 characters or fewer";
  }

  if (data.whatsapp && !/^\+[1-9]\d{6,14}$/.test(data.whatsapp)) {
    errors.whatsapp = "Enter a valid number with country code (e.g. +254712345678)";
  }

  return errors;
}

// ── Page ───────────────────────────────────────────────────

export default function CuratorOnboardPage() {
  const [data, setData] = useState<FormData>({
    slug: "",
    name: "",
    whatsapp: "",
    verticals: ["football"],
    brandPrimary: "#1a1a2e",
    brandAccent: "#e94560",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [serverMessage, setServerMessage] = useState("");
  const [storefrontUrl, setStorefrontUrl] = useState("");
  const [gSectionOpen, setGSectionOpen] = useState(false);
  const [gClaimed, setGClaimed] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(storefrontUrl);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = storefrontUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2500);
  }, [storefrontUrl]);

  const handleWhatsAppShare = useCallback(() => {
    const shareText = `Check out my storefront on OnPoint — try on items with AI and shop direct! ${storefrontUrl}`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(shareText)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }, [storefrontUrl]);

  const handleChange = useCallback(
    (field: keyof FormData, value: string | string[]) => {
      setData((prev) => ({ ...prev, [field]: value }));
      // Clear error on edit
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    },
    [],
  );

  const toggleVertical = useCallback((id: string) => {
    setData((prev) => {
      const next = prev.verticals.includes(id)
        ? prev.verticals.filter((v) => v !== id)
        : [...prev.verticals, id];
      return { ...prev, verticals: next.length === 0 ? [id] : next };
    });
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const validationErrors = validate(data);
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }

      setSubmitState("submitting");
      setServerMessage("");

      try {
        const res = await fetch(`${getApiBase()}/api/curator/apply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: data.slug,
            name: data.name,
            whatsapp: data.whatsapp || undefined,
            verticals: data.verticals,
            brand: {
              colors: {
                primary: data.brandPrimary,
                accent: data.brandAccent,
              },
            },
          }),
        });

        const body = await res.json();

        if (res.ok) {
          // Construct URL from current origin — the API returns
          // onpoint.famile.xyz which doesn't resolve; the live site
          // is wherever this frontend is deployed (e.g. beonpoint.netlify.app)
          const origin =
            typeof window !== "undefined"
              ? window.location.origin
              : "https://beonpoint.netlify.app";
          setStorefrontUrl(`${origin}/s/${data.slug}`);
          setSubmitState("success");
        } else if (res.status === 409) {
          setErrors({ slug: body.message || "Slug already taken" });
          setSubmitState("idle");
        } else {
          setServerMessage(body.error || "Something went wrong. Please try again.");
          setSubmitState("error");
        }
      } catch (err) {
        setServerMessage(
          "Could not reach the server. Make sure the API is running on port 48751.",
        );
        setSubmitState("error");
      }
    },
    [data],
  );

  // ── Success state ──────────────────────────────────────

  if (submitState === "success") {
    return (
      <main className="min-h-screen bg-background text-foreground selection:bg-primary/30">
        <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          </div>

          <h1 className="text-3xl font-black tracking-tight">
            {data.name ? `${data.name}, your` : "Your"} storefront is live!
          </h1>
          <p className="mt-3 max-w-sm text-muted-foreground">
            Your OnPoint storefront is ready. Here&apos;s your link:
          </p>

          <a
            href={storefrontUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-5 py-3 text-lg font-bold text-primary transition-all hover:bg-primary/10 hover:shadow-lg"
          >
            <Store className="h-5 w-5" />
            {storefrontUrl.replace("https://", "")}
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>

          {/* One-tap share actions */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium transition-all hover:bg-muted active:scale-[0.98]"
            >
              {linkCopied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-500" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy link
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-emerald-600 active:scale-[0.98]"
            >
              <MessageCircle className="h-4 w-4" />
              Share on WhatsApp
            </button>
          </div>

          <div className="mt-10 w-full space-y-4 text-left">
            <h2 className="text-lg font-bold">Next steps</h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <MessageCircle className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">Add inventory via WhatsApp</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Send a message like <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">+ arsenal home M 2500 4</code> with a photo to our agent — it creates a listing instantly.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10">
                  <Share2 className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <p className="font-semibold">Share your storefront</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Send the link to your customers. They land on a branded page, try on items, get a polaroid, and buy on WhatsApp — no app download needed.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                  <ShoppingBag className="h-4 w-4 text-emerald-500" />
                </div>
                <div>
                  <p className="font-semibold">Get paid directly</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Checkout happens on WhatsApp — you handle payment however works best (M-Pesa, bank transfer, cash). Zero platform fees.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link
              href={storefrontUrl}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white transition-all hover:bg-primary/90 hover:shadow-lg"
            >
              <Store className="h-4 w-4" />
              View storefront
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-3 text-sm font-bold text-muted-foreground transition-all hover:bg-card hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to OnPoint
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ── Form ───────────────────────────────────────────────

  const slugPreview = data.slug
    ? `onpoint.famile.xyz/s/${data.slug.toLowerCase().replace(/[^a-z0-9-]/g, "")}`
    : null;

  return (
    <main className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            OnPoint
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            Curator onboarding
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-border bg-gradient-to-b from-card to-background">
        <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20">
            <Store className="h-7 w-7 text-white" />
          </div>
          <h1 className="mt-6 text-center text-3xl font-black tracking-tight md:text-4xl">
            Start your OnPoint storefront
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-center text-muted-foreground">
            Get a branded page with try-on, polaroid share, and WhatsApp checkout
            — no coding, no app store submission.
          </p>
        </div>
      </section>

      {/* Form */}
      <section className="mx-auto max-w-3xl px-4 py-10">
        <form onSubmit={handleSubmit} className="space-y-10">
          {/* ── Basics ── */}
          <div className="space-y-5">
            <h2 className="text-lg font-bold">Basics</h2>

            {/* Slug */}
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Storefront slug
              </label>
              <input
                type="text"
                value={data.slug}
                onChange={(e) =>
                  handleChange(
                    "slug",
                    e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                  )
                }
                placeholder="mo-jerseys"
                maxLength={48}
                className={`w-full rounded-xl border bg-card px-4 py-3 text-sm outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 ${
                  errors.slug ? "border-destructive/50" : "border-border"
                }`}
                autoComplete="off"
                spellCheck={false}
              />
              {slugPreview && (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-primary/10 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                  <Globe className="h-3.5 w-3.5 text-primary" />
                  <span>
                    Your storefront will be at{" "}
                    <span className="font-medium text-foreground">
                      {slugPreview}
                    </span>
                  </span>
                </div>
              )}
              {errors.slug && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  {errors.slug}
                </p>
              )}
            </div>

            {/* Name */}
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Your name
              </label>
              <input
                type="text"
                value={data.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="Wanja"
                maxLength={100}
                className={`w-full rounded-xl border bg-card px-4 py-3 text-sm outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 ${
                  errors.name ? "border-destructive/50" : "border-border"
                }`}
              />
              {errors.name && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  {errors.name}
                </p>
              )}
            </div>

            {/* WhatsApp */}
            <div>
              <label className="mb-1.5 flex items-center gap-2 text-sm font-medium">
                <MessageCircle className="h-4 w-4 text-emerald-500" />
                WhatsApp number
                <span className="text-xs font-normal text-muted-foreground">
                  (optional now, needed for checkout)
                </span>
              </label>
              <input
                type="tel"
                value={data.whatsapp}
                onChange={(e) => handleChange("whatsapp", e.target.value)}
                placeholder="+254712345678"
                className={`w-full rounded-xl border bg-card px-4 py-3 text-sm outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 ${
                  errors.whatsapp ? "border-destructive/50" : "border-border"
                }`}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Include country code. Customers will message you here to place orders.
              </p>
              {errors.whatsapp && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  {errors.whatsapp}
                </p>
              )}
            </div>
          </div>

          {/* ── Verticals ── */}
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold">What do you sell?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Pick one or more categories. You can change these later.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {VERTICALS.map((v) => {
                const selected = data.verticals.includes(v.id);
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => toggleVertical(v.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium transition-all ${
                      selected
                        ? "border-primary/40 bg-primary/10 text-primary shadow-sm"
                        : "border-border bg-card text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground"
                    }`}
                  >
                    <span>{v.emoji}</span>
                    <span>{v.label}</span>
                    {selected && <Check className="h-3 w-3" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Brand ── */}
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold">Brand colors</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Optional. Your storefront uses these for buttons and headers.
                We provide defaults if you skip this.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Primary
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={data.brandPrimary}
                    onChange={(e) => handleChange("brandPrimary", e.target.value)}
                    className="h-10 w-10 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
                  />
                  <input
                    type="text"
                    value={data.brandPrimary}
                    onChange={(e) => handleChange("brandPrimary", e.target.value)}
                    className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-mono outline-none transition-all focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                    placeholder="#1a1a2e"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Accent
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={data.brandAccent}
                    onChange={(e) => handleChange("brandAccent", e.target.value)}
                    className="h-10 w-10 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
                  />
                  <input
                    type="text"
                    value={data.brandAccent}
                    onChange={(e) => handleChange("brandAccent", e.target.value)}
                    className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-mono outline-none transition-all focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                    placeholder="#e94560"
                  />
                </div>
              </div>
            </div>

            {/* Color preview */}
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="bg-card px-4 py-3 text-xs font-medium text-muted-foreground">
                Storefront color preview
              </div>
              <div className="flex h-2 w-full">
                <div
                  className="h-full"
                  style={{ background: data.brandPrimary, width: "60%" }}
                />
                <div
                  className="h-full"
                  style={{ background: data.brandAccent, width: "40%" }}
                />
              </div>
              <div className="flex gap-3 bg-card p-4">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-lg text-lg font-bold text-white shadow-sm"
                  style={{ background: data.brandPrimary }}
                >
                  {data.name ? data.name.charAt(0).toUpperCase() : "?"}
                </div>
                <div
                  className="flex flex-1 items-center justify-center rounded-lg px-4 py-2 text-sm font-bold text-white shadow-sm"
                  style={{ background: data.brandAccent }}
                >
                  {data.name || "Your Name"}&aposs storefront
                </div>
              </div>
            </div>
          </div>

          {/* ── GoodDollar UBI claim (optional) ── */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setGSectionOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/30"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
                  <Gift className="h-4 w-4 text-emerald-500" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground">
                    Claim today&apos;s G$ UBI?
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Free daily GoodDollar — optional, takes 10 seconds.
                  </p>
                </div>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${
                  gSectionOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {gSectionOpen && (
              <div className="space-y-3 rounded-xl border border-border bg-card p-4">
                {gClaimed && (
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                    <CheckCircle className="h-4 w-4 shrink-0" />
                    G$ claimed! Funds are in your wallet on Celo.
                  </div>
                )}
                <GClaimCTA
                  onClaimed={() => setGClaimed(true)}
                />
                <p className="text-xs text-muted-foreground">
                  GoodDollar is a UBI protocol on Celo. You can claim once per
                  day if you have a verified GoodDollar identity.
                </p>
              </div>
            )}
          </div>

          {/* ── Error banner ── */}
          {serverMessage && (
            <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Submission failed</p>
                <p className="mt-1 text-destructive/80">{serverMessage}</p>
              </div>
              <button
                type="button"
                onClick={() => setServerMessage("")}
                className="ml-auto shrink-0 text-destructive/60 hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* ── Submit ── */}
          <div className="flex flex-col gap-3 border-t border-border pt-8">
            <button
              type="submit"
              disabled={submitState === "submitting"}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitState === "submitting" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating storefront…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Create storefront
                </>
              )}
            </button>
            <p className="text-center text-xs text-muted-foreground">
              Free to create. No credit card. Takes 30 seconds.
            </p>
          </div>
        </form>
      </section>
    </main>
  );
}
