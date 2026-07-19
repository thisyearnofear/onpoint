"use client";

import React from "react";
import { Button } from "@repo/ui/button";
import { Badge } from "@repo/ui/badge";
import {
  Bookmark,
  CheckCircle,
  Copy,
  Image as ImageIcon,
  MessageCircle,
  Palette,
  Ruler,
  Send,
  Share2,
  Shirt,
  Sparkles,
  Store,
  User,
  Wallet,
} from "lucide-react";
import type { StylistPersona, VirtualTryOnAnalysis } from "@repo/ai-client";
import type { TryOnSelection } from "../../lib/utils/try-on-selection";
import { getPersonaConfig } from "../../lib/utils/persona-config";
import { AnalysisSkeleton } from "./AnalysisSkeleton";
import { useAnalysisHistory } from "../../lib/stores/analysis-history-store";
import { StyleReportCard } from "./StyleReportCard";
import { SafeImage } from "../SafeImage";
import {
  trackLookSaved,
  trackStyleCardOpened,
} from "../../lib/utils/analytics";
import { fireConfetti } from "../../lib/utils/confetti";

interface AnalysisResultsProps {
  analysis: VirtualTryOnAnalysis;
  previewUrl?: string;
  selectedGarment?: TryOnSelection | null;
  onCritiqueModeSelection?: () => void;
  onShopRecommendations?: () => void;
  preferences?: any;
}

const SHARE_PERSONAS: StylistPersona[] = [
  "miranda",
  "edina",
  "shaft",
  "luxury",
  "streetwear",
  "sustainable",
];

function getArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function selectPersona(analysis: VirtualTryOnAnalysis): StylistPersona {
  const seed = `${analysis.bodyType || ""}:${getArray((analysis as any).currentLook)[0] || ""}`;
  const total = seed.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return SHARE_PERSONAS[total % SHARE_PERSONAS.length] || "miranda";
}

function buildPersonaQuote(
  persona: StylistPersona,
  bodyType: string,
  styleTip: string,
) {
  const conciseTip = styleTip.replace(/\.$/, "");
  switch (persona) {
    case "edina":
      return `Darling, the proportions are doing the work. Keep the drama intentional: ${conciseTip}.`;
    case "shaft":
      return `This has presence. Lead with the fit, then let the styling detail sharpen the whole look: ${conciseTip}.`;
    case "luxury":
      return `The strongest read is restraint. For a ${bodyType || "balanced"} profile, polish comes from proportion and finish.`;
    case "streetwear":
      return `The silhouette is the signal. Push one hero detail and let the rest stay clean: ${conciseTip}.`;
    case "sustainable":
      return `A strong wardrobe move is the one you can repeat. Build around fit first, then choose pieces with longevity.`;
    case "miranda":
    default:
      return `The direction is clear: refine the silhouette, protect the proportions, and make the styling choice look deliberate.`;
  }
}

export function AnalysisResults({
  analysis,
  previewUrl,
  selectedGarment,
  onCritiqueModeSelection,
  onShopRecommendations,
  preferences,
}: AnalysisResultsProps) {
  const [expandedSection, setExpandedSection] = React.useState<string | null>(null);
  const [showLoading, setShowLoading] = React.useState(true);
  const [copied, setCopied] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [showStyleCard, setShowStyleCard] = React.useState(false);

  const [shareToCommunity, setShareToCommunity] = React.useState(false);
  const { addSession, isFirstSession } = useAnalysisHistory();

  React.useEffect(() => {
    const timer = setTimeout(() => setShowLoading(false), 600);
    return () => clearTimeout(timer);
  }, [analysis]);

  if (showLoading) {
    return <AnalysisSkeleton staggered showActions />;
  }

  const currentLook = getArray((analysis as any).currentLook);
  const fitRecommendations = getArray((analysis as any).fitRecommendations || analysis.fitRecommendations);
  const styleRecommendations = getArray((analysis as any).styleRecommendations || analysis.styleAdjustments);
  const personalization = getArray((analysis as any).personalization);
  const bodyType = analysis.bodyType || preferences?.bodyType || "Personal";
  const persona = selectPersona(analysis);
  const personaStyle = getPersonaConfig(persona);
  const PersonaIcon = personaStyle.icon;
  const topStyleTip = styleRecommendations[0] || fitRecommendations[0] || "keep the silhouette intentional";
  const personaQuote = buildPersonaQuote(persona, bodyType, topStyleTip);
  const shareText = `OnPoint styled my look as ${bodyType}. ${personaStyle.characterName}: "${personaQuote}"`;
  const curator = selectedGarment?.curator;
  const curatorName = curator?.name || "Wanja";
  const curatorSlug = curator?.slug || "wanja";
  const curatorWhatsApp = curator?.whatsapp?.replace(/^\+/, "");
  const storefrontHref = `/s/${encodeURIComponent(curatorSlug)}`;
  const curatorBrief = [
    `Hi ${curatorName}, OnPoint prepared a style brief for me.`,
    selectedGarment?.name ? `Item: ${selectedGarment.name}` : null,
    `Fit profile: ${bodyType}`,
    topStyleTip ? `Styling note: ${topStyleTip}` : null,
    "Can you recommend, source, or confirm the best piece for this look?",
  ].filter(Boolean).join("\n");
  const curatorHref = curatorWhatsApp
    ? `https://wa.me/${curatorWhatsApp}?text=${encodeURIComponent(curatorBrief)}`
    : storefrontHref;
  const hasPreferences = preferences && (
    (preferences.styleAesthetics?.length > 0) ||
    preferences.budgetTier ||
    preferences.bodyType
  );

  const handleSaveLook = React.useCallback(() => {
    if (saved) return;
    const recommendations = selectedGarment
      ? [{ name: selectedGarment.name, price: selectedGarment.price || 0, category: selectedGarment.category || 'general' }]
      : [];
    addSession({
      score: analysis.score || 5,
      sessionGoal: preferences?.sessionGoal || null,
      persona,
      headline: currentLook[0] || 'Style analysis',
      takeaways: styleRecommendations,
      topics: fitRecommendations.slice(0, 4),
      coverImage: previewUrl || null,
      extraImages: [],
      recommendations,
    });
    setSaved(true);

    // Share to community (anonymously) if opted in
    if (shareToCommunity) {
      fetch("/api/community/looks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score: analysis.score || 5,
          persona,
          headline: currentLook[0] || 'Style analysis',
          takeaways: styleRecommendations,
          topics: fitRecommendations.slice(0, 4),
        }),
      })
        .then(async (res) => {
          if (!res.ok) return;
          const data = await res.json();
          if (data.look?.id) {
            // Store submitted look ID in localStorage for engagement tracking
            try {
              const existing = JSON.parse(
                localStorage.getItem("onpoint-my-submitted-looks") || "[]",
              );
              existing.push(data.look.id);
              // Keep only last 20
              if (existing.length > 20) existing.shift();
              localStorage.setItem(
                "onpoint-my-submitted-looks",
                JSON.stringify(existing),
              );
            } catch {
              // ignore
            }
          }
        })
        .catch(() => undefined); // Best-effort — never block the save
    }

    // Fire confetti on first-ever save
    if (isFirstSession()) {
      setTimeout(() => fireConfetti({ particleCount: 80 }), 200);
    }
    trackLookSaved({
      score: analysis.score || 5,
      persona,
      garmentCategory: selectedGarment?.category,
      hasImage: Boolean(previewUrl),
      source: "analysis_result",
    });
  }, [saved, analysis, preferences, persona, currentLook, styleRecommendations, fitRecommendations, previewUrl, selectedGarment, addSession, shareToCommunity]);

  const copyShareText = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    await navigator.clipboard.writeText(`${shareText}\n\nbeonpoint.netlify.app`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const shareToX = () => {
    if (typeof window === "undefined") return;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${shareText}\n\nbeonpoint.netlify.app`)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const shopRecommendations = onShopRecommendations || (() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("stylistAnalysis", JSON.stringify({
        bodyType: analysis.bodyType,
        measurements: analysis.measurements,
        styleRecommendations,
        personalization,
      }));
      window.location.href = "/shop";
    }
  });

  const captureCuratorLead = () => {
    if (typeof window === "undefined") return;
    const payload = {
      curatorSlug,
      listingId: selectedGarment?.id || null,
      styleProfile: bodyType,
      selectedItem: selectedGarment?.name || null,
      source: "try-on-result",
      action: "send_curator_brief",
    };
    const body = JSON.stringify(payload);

    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/curator/leads",
        new Blob([body], { type: "application/json" }),
      );
      return;
    }

    fetch("/api/curator/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-primary/20 bg-card elegant-shadow">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="relative min-h-[420px] bg-muted">
          {previewUrl ? (
            <SafeImage
              sources={[previewUrl]}
              alt="Your analyzed look"
              fill
              unoptimized
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <User className="h-16 w-16 text-muted-foreground/40" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute left-4 top-4 flex flex-wrap gap-2">
            <Badge className="border-white/20 bg-background/85 text-foreground backdrop-blur">
              <Sparkles className="mr-1 h-3 w-3 text-primary" />
              OnPoint Style Report
            </Badge>
            <Badge className="border-white/20 bg-background/85 text-foreground backdrop-blur">
              {bodyType}
            </Badge>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
            <p className="text-xs uppercase tracking-[0.22em] text-white/65">Your photo, styled</p>
            <h3 className="mt-1 text-2xl font-semibold leading-tight">
              {currentLook[0] || "A personalized fit profile is ready."}
            </h3>
            {currentLook.length > 1 && (
              <p className="mt-2 max-w-md text-sm leading-relaxed text-white/75">
                {currentLook[1]}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
                Analysis complete
              </p>
              <h3 className="mt-1 text-xl font-semibold">Here is the styling read</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Condensed into the decisions that actually help you dress, shop, and share.
              </p>
            </div>
            <Badge variant="outline" className="shrink-0 border-primary/30 text-primary">
              Ready
            </Badge>
          </div>

          {hasPreferences && (
            <div className="rounded-xl border border-border bg-muted/25 p-3">
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span>Tuned for</span>
                {preferences.styleAesthetics?.slice(0, 3).map((a: string) => (
                  <span key={a} className="rounded-full bg-background px-2 py-0.5 font-medium text-foreground">
                    {a}
                  </span>
                ))}
                {preferences.budgetTier && (
                  <span className="rounded-full bg-background px-2 py-0.5 font-medium text-foreground">
                    {preferences.budgetTier.replace("-", " ")}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-muted/20 p-3">
              <User className="h-4 w-4 text-primary" />
              <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">Profile</p>
              <p className="text-sm font-semibold">{bodyType}</p>
            </div>
            {Object.entries(analysis.measurements).slice(0, 2).map(([key, value]) => (
              <div key={key} className="rounded-xl border border-border bg-muted/20 p-3">
                <Ruler className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground capitalize">
                  {key}
                </p>
                <p className="truncate text-sm font-semibold">{value || "Balanced"}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-3">
            <InsightCard
              icon={Shirt}
              title="Fit move"
              tone="emerald"
              items={fitRecommendations}
              expanded={expandedSection === "fit"}
              onToggle={() => setExpandedSection(expandedSection === "fit" ? null : "fit")}
            />
            <InsightCard
              icon={Palette}
              title="Style direction"
              tone="indigo"
              items={styleRecommendations}
              expanded={expandedSection === "style"}
              onToggle={() => setExpandedSection(expandedSection === "style" ? null : "style")}
            />
            {personalization.length > 0 && (
              <InsightCard
                icon={Sparkles}
                title="For you"
                tone="amber"
                items={personalization}
                expanded={expandedSection === "personal"}
                onToggle={() => setExpandedSection(expandedSection === "personal" ? null : "personal")}
              />
            )}
          </div>

          <div className={`rounded-2xl border p-4 ${personaStyle.border} ${personaStyle.bg}`}>
            <div className="flex items-start gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${personaStyle.gradient} text-white`}>
                <PersonaIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{personaStyle.characterName}</p>
                  <Badge variant="outline" className="text-[10px]">
                    Shareable take
                  </Badge>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-foreground">"{personaQuote}"</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={copyShareText} className="h-8 gap-1.5 text-xs">
                    <Copy className="h-3.5 w-3.5" />
                    {copied ? "Copied" : "Copy"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={shareToX} className="h-8 gap-1.5 text-xs">
                    <Share2 className="h-3.5 w-3.5" />
                    Post to X
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
                <Store className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{curatorName}'s handoff</p>
                  <Badge variant="outline" className="text-[10px]">
                    Human curator
                  </Badge>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  OnPoint has turned this scan into a curator-ready brief. Ask {curatorName} to
                  confirm the fit, recommend a stocked piece, or source the missing item.
                </p>
                {selectedGarment?.name && (
                  <div className="mt-3 rounded-xl border border-border bg-muted/25 p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Current piece
                    </p>
                    <p className="mt-1 text-sm font-semibold">{selectedGarment.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedGarment.source?.startsWith("storefront:")
                        ? "Curator-stocked item"
                        : "AI-matched catalog item"}
                    </p>
                  </div>
                )}
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <a
                    href={curatorHref}
                    onClick={captureCuratorLead}
                    target={curatorHref.startsWith("http") ? "_blank" : undefined}
                    rel={curatorHref.startsWith("http") ? "noopener noreferrer" : undefined}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Send brief
                  </a>
                  <a
                    href={storefrontHref}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border px-3 text-xs font-semibold transition-colors hover:bg-muted"
                  >
                    <Store className="h-3.5 w-3.5" />
                    Shop edit
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Save & Share row */}
          <div className="flex items-center gap-2 border-t border-border/60 pt-4">
            <div className="flex items-center gap-1.5">
            <button
              onClick={handleSaveLook}
              disabled={saved}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-all ${
                saved
                  ? "border-success/30 bg-success/10 text-success dark:text-emerald-400"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {saved ? (
                <><Bookmark className="h-3.5 w-3.5 fill-current" /> Saved</>
              ) : (
                <><Bookmark className="h-3.5 w-3.5" /> Save look</>
              )}
            </button>
            {!saved && (
              <label className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-transparent text-[10px] text-muted-foreground/60 cursor-pointer hover:text-muted-foreground hover:border-border/40 transition-all">
                <input
                  type="checkbox"
                  checked={shareToCommunity}
                  onChange={(e) => setShareToCommunity(e.target.checked)}
                  className="w-3 h-3 rounded border-border accent-primary"
                />
                Share to community
              </label>
            )}
          </div>
            <button
              onClick={() => {
                setShowStyleCard(true);
                trackStyleCardOpened({
                  score: analysis.score || 5,
                  persona,
                  hasImage: Boolean(previewUrl),
                  hasGarment: Boolean(selectedGarment),
                });
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ImageIcon className="h-3.5 w-3.5" />
              Style card
            </button>
            <div className="ml-auto flex items-center gap-2">
              {onCritiqueModeSelection && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onCritiqueModeSelection}
                  className="h-9 gap-1.5 text-xs"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Critique
                </Button>
              )}
              <Button
                variant="default"
                size="sm"
                onClick={shopRecommendations}
                className="h-9 gap-1.5 bg-gradient-to-r from-primary to-accent text-xs"
              >
                <Wallet className="h-3.5 w-3.5" />
                Shop
              </Button>
            </div>
          </div>

          {/* Style Report Card modal */}
          {showStyleCard && (
            <StyleReportCard
              score={analysis.score || 5}
              persona={persona}
              takeaways={styleRecommendations}
              topics={fitRecommendations.slice(0, 4)}
              captureImage={previewUrl || undefined}
              sessionGoal={preferences?.sessionGoal || "style analysis"}
              onClose={() => setShowStyleCard(false)}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function InsightCard({
  icon: Icon,
  title,
  tone,
  items,
  expanded,
  onToggle,
}: {
  icon: React.ElementType;
  title: string;
  tone: "emerald" | "indigo" | "amber";
  items: string[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const colors = {
    emerald: "border-success/25 bg-success/10 text-success dark:text-emerald-300",
    indigo: "border-indigo-500/25 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
    amber: "border-warning/25 bg-warning/10 text-warning dark:text-amber-300",
  };
  const shown = expanded ? items : items.slice(0, 1);
  const fallback = title === "Fit move"
    ? "Keep the strongest line clean and avoid adding bulk where the silhouette already has structure."
    : "Choose one styling detail to lead, then keep the rest of the look intentional.";

  return (
    <div className={`rounded-xl border p-3 ${colors[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold">
          <Icon className="h-3.5 w-3.5" />
          {title}
        </h4>
        {items.length > 1 && (
          <button onClick={onToggle} className="text-[10px] font-medium underline-offset-2 hover:underline">
            {expanded ? "Less" : `+${items.length - 1}`}
          </button>
        )}
      </div>
      <div className="mt-2 space-y-2">
        {(shown.length ? shown : [fallback]).map((item, index) => (
          <div key={`${title}-${index}`} className="flex items-start gap-2 text-xs leading-relaxed text-foreground/80">
            <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
