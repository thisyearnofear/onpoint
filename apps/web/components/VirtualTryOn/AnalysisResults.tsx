"use client";

import React from "react";
import {
  Bookmark,
  Check,
  Image as ImageIcon,
  MessageCircle,
  Send,
  Shirt,
  Sparkles,
  User,
} from "lucide-react";
import type { StylistPersona, VirtualTryOnAnalysis } from "@repo/ai-client";
import type { TryOnSelection } from "../../lib/utils/try-on-selection";
import { AnalysisSkeleton } from "./AnalysisSkeleton";
import { useAnalysisHistory } from "../../lib/stores/analysis-history-store";
import { StyleReportCard } from "./StyleReportCard";
import { SafeImage } from "../SafeImage";
import { Lookbook, Cover, Spread, BackPage } from "../lookbook";
import type { LookbookPage } from "../lookbook";
import { Busy } from "../state";
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
  onGenerateTryOn?: () => void;
  tryOnLoading?: boolean;
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

/**
 * The post-upload read, composed as a lookbook issue: the photo is the
 * cover (object-contain — the person is never cropped), the fit read and
 * notes are interior spreads, the picked piece gets its own plate, and the
 * last page carries the next loop (try-on, save, share, critique, shop).
 * The persona quote, measurement tiles and accordion insight cards were
 * ceremony around the same three facts — the style card modal carries the
 * shareable artifact.
 */
export function AnalysisResults({
  analysis,
  previewUrl,
  selectedGarment,
  onCritiqueModeSelection,
  onShopRecommendations,
  onGenerateTryOn,
  tryOnLoading = false,
  preferences,
}: AnalysisResultsProps) {
  const [showLoading, setShowLoading] = React.useState(true);
  const [saved, setSaved] = React.useState(false);
  const [showStyleCard, setShowStyleCard] = React.useState(false);
  const [shareToCommunity, setShareToCommunity] = React.useState(false);
  const { addSession, isFirstSession } = useAnalysisHistory();

  React.useEffect(() => {
    const timer = setTimeout(() => setShowLoading(false), 600);
    return () => clearTimeout(timer);
  }, [analysis]);

  const currentLook = getArray((analysis as any).currentLook);
  const fitRecommendations = getArray((analysis as any).fitRecommendations || analysis.fitRecommendations);
  const styleRecommendations = getArray((analysis as any).styleRecommendations || analysis.styleAdjustments);
  const bodyType = analysis.bodyType || preferences?.bodyType || "Personal";
  const persona = selectPersona(analysis);
  const topStyleTip = styleRecommendations[0] || fitRecommendations[0] || "keep the silhouette intentional";

  // The read, condensed: profile + first two measurements on one quiet line.
  const measurementsLine = Object.entries(analysis.measurements || {})
    .slice(0, 2)
    .map(([key, value]) => `${key} ${value || "balanced"}`)
    .join(" · ");

  // Two notes max — the fit move first, then one style direction.
  const notes = [
    ...fitRecommendations.slice(0, 1),
    ...styleRecommendations.slice(0, 1),
  ].slice(0, 2);

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
            try {
              const existing = JSON.parse(
                localStorage.getItem("onpoint-my-submitted-looks") || "[]",
              );
              existing.push(data.look.id);
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
  }, [saved, analysis, preferences, persona, currentLook, styleRecommendations, fitRecommendations, previewUrl, selectedGarment, addSession, shareToCommunity, isFirstSession]);

  // Skeleton gate must sit below every hook — React #310 if a useCallback
  // runs on the second render but not the first.
  if (showLoading) {
    return <AnalysisSkeleton staggered showActions />;
  }

  // Degraded path: the render/enhance call failed upstream, so the report is a
  // conservative profile, not a read of the photo. Name that at the top and
  // stop — no ceremony around a missing render.
  if ((analysis as { fallbackReason?: string }).fallbackReason) {
    return (
      <div className="border border-border bg-card p-6">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-warning">
          Styling service is having trouble
        </p>
        <h2 className="mt-3 font-display text-3xl leading-[1.05] tracking-[-0.02em]">
          This read is a fallback — it didn&apos;t see your photo.
        </h2>
        <p className="mt-4 text-sm text-muted-foreground">
          {topStyleTip} Try again in a bit with a clear, well-lit full-body
          photo for a sharper read — or browse the edit below.
        </p>
      </div>
    );
  }

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

  const shopRecommendations = onShopRecommendations || (() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("stylistAnalysis", JSON.stringify({
        bodyType: analysis.bodyType,
        measurements: analysis.measurements,
        styleRecommendations,
      }));
      window.location.href = "/shop";
    }
  });

  // The issue: cover (the person, uncropped) → the read → the piece →
  // the last page (the next loop). Products are marginalia, never the page.
  const pages: LookbookPage[] = [
    {
      key: "cover",
      label: "Cover",
      node: (
        <Cover
          eyebrow="Your issue"
          title={currentLook[0] || "Your fit read."}
          byline={`${bodyType}${measurementsLine ? ` · ${measurementsLine}` : ""}`}
        >
          <div className="flex h-full w-full items-center justify-center">
            {previewUrl ? (
              <div className="relative h-full max-h-full w-full">
                <SafeImage
                  sources={[previewUrl]}
                  alt="Your photo — the cover of this issue"
                  fill
                  unoptimized
                  className="object-contain"
                />
              </div>
            ) : (
              <div className="flex h-full w-full items-center justify-center border border-border bg-muted/40">
                <User className="h-16 w-16 text-muted-foreground/40" />
              </div>
            )}
          </div>
        </Cover>
      ),
    },
    {
      key: "read",
      label: "The read",
      node: (
        <Spread eyebrow="The read">
          <div className="space-y-4 overflow-y-auto">
            {currentLook.slice(1).map((line, i) => (
              <p key={i} className="font-display text-lg italic leading-snug text-foreground/85">
                {line}
              </p>
            ))}
            {notes.length > 0 && (
              <ul className="space-y-2 border-t border-border/60 pt-4">
                {notes.map((note, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-foreground/80">
                    <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Spread>
      ),
    },
  ];

  if (selectedGarment?.name) {
    pages.push({
      key: "piece",
      label: "The piece",
      node: (
        <Spread eyebrow="The piece">
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
            <div className="relative mx-auto aspect-square w-full max-w-[240px] overflow-hidden border border-border bg-muted/40">
              {selectedGarment.imageUrl ? (
                <SafeImage
                  sources={[selectedGarment.imageUrl]}
                  alt={selectedGarment.name}
                  fill
                  unoptimized
                  className="object-contain"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Shirt className="h-10 w-10 text-muted-foreground/40" />
                </div>
              )}
            </div>
            <div className="text-center">
              <p className="font-display text-xl leading-tight">{selectedGarment.name}</p>
              {selectedGarment.description && (
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {selectedGarment.description}
                </p>
              )}
            </div>
            <div className="mt-auto border-t border-border/60 pt-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Confirm fit &amp; stock with {curatorName}
                </p>
                <a
                  href={curatorHref}
                  onClick={captureCuratorLead}
                  target={curatorHref.startsWith("http") ? "_blank" : undefined}
                  rel={curatorHref.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90"
                >
                  <Send className="h-3.5 w-3.5" />
                  Send brief
                </a>
              </div>
            </div>
          </div>
        </Spread>
      ),
    });
  }

  pages.push({
    key: "back",
    label: "The last page",
    node: (
      <BackPage eyebrow="The last page">
        {onGenerateTryOn && (
          <button
            type="button"
            onClick={onGenerateTryOn}
            disabled={tryOnLoading || !selectedGarment}
            className="inline-flex min-h-12 w-full max-w-xs items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {tryOnLoading ? (
              <Busy label="Generating try-on" tone="inverse" />
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate AI Try-On
              </>
            )}
          </button>
        )}
        {!selectedGarment && onGenerateTryOn && (
          <p className="text-xs text-muted-foreground">Pick a piece first — swap below.</p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={handleSaveLook}
            disabled={saved}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-xs font-bold transition-colors ${
              saved
                ? "border-success/40 text-success"
                : "border-border text-foreground hover:border-foreground"
            }`}
          >
            <Bookmark className={`h-3.5 w-3.5 ${saved ? "fill-current" : ""}`} />
            {saved ? "Saved" : "Save look"}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowStyleCard(true);
              trackStyleCardOpened({
                score: analysis.score || 5,
                persona,
                hasImage: Boolean(previewUrl),
                hasGarment: Boolean(selectedGarment),
              });
            }}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border px-4 text-xs font-bold text-foreground transition-colors hover:border-foreground"
          >
            <ImageIcon className="h-3.5 w-3.5" />
            Style card
          </button>
          {!saved && (
            <label className="flex cursor-pointer items-center gap-1.5 px-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
              <input
                type="checkbox"
                checked={shareToCommunity}
                onChange={(e) => setShareToCommunity(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border accent-primary"
              />
              Share to community
            </label>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-bold text-muted-foreground">
          {onCritiqueModeSelection && (
            <button
              type="button"
              onClick={onCritiqueModeSelection}
              className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Critique
            </button>
          )}
          <button
            type="button"
            onClick={shopRecommendations}
            className="transition-colors hover:text-foreground"
          >
            Shop the edit →
          </button>
        </div>
      </BackPage>
    ),
  });

  return (
    <>
      <Lookbook pages={pages} widthClassName="max-w-lg" />

      {/* Style Report Card modal — the shareable artifact lives here */}
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
    </>
  );
}
