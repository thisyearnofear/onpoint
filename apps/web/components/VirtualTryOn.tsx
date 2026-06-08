"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@repo/ui/button";
import { Upload, Camera, CheckCircle2, Palette, Ruler, ShieldCheck, Sparkles, Wand2 } from "lucide-react";
import dynamic from "next/dynamic";
// framer-motion removed — using CSS transitions instead
import { useVirtualTryOn } from "@repo/ai-client";
import { useAIVirtualTryOnEnhancement } from "@repo/ai-client";
import { useReplicateVirtualTryOn } from "@repo/ai-client";
import { imageFileToDataUrl } from "@repo/ai-client";
import type { StylistPersona } from "@repo/ai-client";
import type { QualityCheckResult } from "./VirtualTryOn/usePhotoQualityCheck";

import { FREE_PERSONAS, PREMIUM_PERSONAS, isPersonaUnlocked, getPersonaConfig } from "../lib/utils/persona-config";
import { usePremiumStatus } from "../hooks/use-premium-status";
import { useUserPreferences } from "../hooks/useUserPreferences";
import { CANVAS_ITEMS } from "@onpoint/shared-types";
import type { TryOnSelection } from "../lib/utils/try-on-selection";
import {
  trackTryOnGarmentSelected,
  trackVirtualTryOnProviderError,
  trackVirtualTryOnProviderOutcome,
  trackDeepLinkPersonaSelected,
  trackDeepLinkPersonaOutcome,
} from "../lib/utils/analytics";

import {
  PhotoUpload,
  AnalysisResults,
  GarmentPicker,
  PersonalityCard,
  CritiqueResult,
  TryOnResult,
} from "./VirtualTryOn/index";

const LiveStylistView = dynamic(
  () => import("./VirtualTryOn/LiveStylistView").then((m) => ({ default: m.LiveStylistView })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-[400px] bg-slate-950 rounded-2xl">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-mono tracking-wider">
            Loading Live Stylist…
          </p>
        </div>
      </div>
    ),
  },
);

function getProviderLabel(enhancement?: {
  provider?: string;
  imageConditioned?: boolean;
} | null) {
  if (enhancement?.imageConditioned || enhancement?.provider === "replicate-idm-vton") {
    return "Image-conditioned try-on";
  }
  if (enhancement?.provider || enhancement) {
    return "AI generated visualization";
  }
  return "Analysis only";
}

const STYLE_SCAN_STEPS = [
  { label: "Secure resize", detail: "Keeping upload lean", icon: ShieldCheck },
  { label: "Color read", detail: "Finding palette cues", icon: Palette },
  { label: "Fit map", detail: "Checking proportion", icon: Ruler },
  { label: "Stylist brief", detail: "Preparing recommendations", icon: Wand2 },
];

function StyleScanLoadingCard({
  previewUrl,
  isPreparingPhoto,
}: {
  previewUrl: string;
  isPreparingPhoto: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-primary/20 bg-card">
      <div className="grid gap-0 sm:grid-cols-[180px_1fr]">
        <div className="relative min-h-[220px] overflow-hidden bg-muted">
          <img
            src={previewUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/70" />
          <div className="absolute inset-x-3 top-4 h-px bg-primary/80 shadow-[0_0_22px_rgba(255,255,255,0.75)] animate-pulse" />
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/20 to-transparent animate-pulse" />
          <div className="absolute bottom-4 left-4 right-4">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-background/85 px-2.5 py-1 text-[10px] font-medium text-foreground backdrop-blur">
              <Sparkles className="h-3 w-3 text-primary" />
              OnPoint Style Scan
            </div>
          </div>
        </div>
        <div className="space-y-4 p-4">
          <div>
            <p className="text-sm font-semibold">
              {isPreparingPhoto ? "Polishing your photo for analysis" : "Building your fit profile"}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {isPreparingPhoto
                ? "We resize the image before sending it so the upload feels fast and stable."
                : "OnPoint is reading color, silhouette, proportion, and styling cues from your photo."}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {STYLE_SCAN_STEPS.map((step, index) => {
              const Icon = step.icon;
              const active = isPreparingPhoto ? index === 0 : index > 0;
              return (
                <div
                  key={step.label}
                  className={`flex min-h-14 items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
                    active
                      ? "border-primary/25 bg-primary/10"
                      : "border-border bg-muted/30"
                  }`}
                >
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    active ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"
                  }`}>
                    {active ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{step.label}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{step.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground">
              <span>{isPreparingPhoto ? "Optimizing upload" : "Personalizing recommendations"}</span>
              <span>{isPreparingPhoto ? "Step 1/4" : "Step 3/4"}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full bg-primary transition-all duration-700 ${
                  isPreparingPhoto ? "w-1/4" : "w-3/4"
                }`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface VirtualTryOnProps {
  selectedTryOnItem?: TryOnSelection | null;
  /** Persona deep-linked from storefront AI second opinion cards. */
  initialPersona?: StylistPersona;
  /** Curator slug the persona was picked from (for display). */
  initialCuratorSlug?: string;
}

type SelectableGarment = TryOnSelection & {
  selectionKey: string;
};

const BODY_TYPE_CATEGORY_MAP: Record<string, string> = {
  athletic: "Shirts",
  hourglass: "Dresses",
  pear: "Dresses",
  apple: "Outerwear",
  rectangle: "Pants",
  "inverted triangle": "Pants",
  petite: "Dresses",
  tall: "Pants",
};

function getRecommendedCategory(bodyType: string): string {
  const lower = bodyType.toLowerCase();
  for (const [key, category] of Object.entries(BODY_TYPE_CATEGORY_MAP)) {
    if (lower.includes(key)) return category;
  }
  return "";
}

/**
 * Banner shown when the user arrives from a storefront AI second-opinion card.
 * Displays the persona name and the curator that recommended them.
 */
function PersonaDeepLinkBanner({
  persona,
  curatorSlug,
  shouldDismiss,
}: {
  persona: StylistPersona;
  curatorSlug?: string;
  shouldDismiss?: boolean;
}) {
  const config = getPersonaConfig(persona);
  const [phase, setPhase] = React.useState<"visible" | "exiting" | "hidden">("visible");

  // When parent signals dismissal (critique arrived), start exit animation
  React.useEffect(() => {
    if (shouldDismiss && phase === "visible") {
      setPhase("exiting");
    }
  }, [shouldDismiss, phase]);

  // When exit animation ends, fully unmount
  const handleAnimationEnd = React.useCallback(() => {
    if (phase === "exiting") setPhase("hidden");
  }, [phase]);

  if (phase === "hidden") return null;

  return (
    <div
      className={`mb-4 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 ${
        phase === "exiting" ? "animate-fade-slide-out" : "animate-fade-slide-in"
      }`}
      onAnimationEnd={handleAnimationEnd}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${config.bg}`}
      >
        <Sparkles className={`h-4 w-4 ${config.lightColor}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold">
          <span className={config.lightColor}>{config.characterName}</span>
          {curatorSlug ? (
            <> picked for you by <span className="font-bold capitalize">{curatorSlug}</span></>
          ) : (
            <> pre-selected for your session</>
          )}
        </p>
        <p className="text-[10px] text-muted-foreground">
          Upload a photo and {config.characterName.split(" ")[0]} will give their take automatically.
        </p>
      </div>
      <button
        onClick={() => setPhase("exiting")}
        className="shrink-0 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
      >
        Dismiss
      </button>
    </div>
  );
}

export function VirtualTryOn({ selectedTryOnItem, initialPersona, initialCuratorSlug }: VirtualTryOnProps) {
  // Core state
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPersonalitySelection, setShowPersonalitySelection] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<StylistPersona | null>(null);
  const [critiqueResult, setCritiqueResult] = useState<{ persona: StylistPersona; critique: string } | null>(null);
  const [showLiveStylist, setShowLiveStylist] = useState(true); // Default to live AR
  const [qualityWarning, setQualityWarning] = useState<string | null>(null);
  const [selectedPhotoData, setSelectedPhotoData] = useState<string | null>(null);
  const [selectedGarmentKey, setSelectedGarmentKey] = useState<string | null>(null);
  const [photoPrepStatus, setPhotoPrepStatus] = useState<"idle" | "optimizing">("idle");

  const { isPremium, loading: premiumLoading } = usePremiumStatus();
  const { preferences } = useUserPreferences();

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const showUploadMode = () => {
      const params = new URLSearchParams(window.location.search);
      const savedMode = window.localStorage.getItem("onpoint-tryon-mode");
      if (params.get("mode") !== "upload" && savedMode !== "upload") {
        return;
      }
      setShowLiveStylist(false);
      window.localStorage.removeItem("onpoint-tryon-mode");
      params.delete("mode");
      const nextQuery = params.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`,
      );
    };

    showUploadMode();
    window.addEventListener("onpoint-tryon-upload-mode", showUploadMode);
    return () => {
      window.removeEventListener("onpoint-tryon-upload-mode", showUploadMode);
    };
  }, []);

  // Hooks
  const {
    analysis,
    loading,
    error,
    analyzePhoto,
    clearAnalysis,
    clearError,
  } = useVirtualTryOn();

  const {
    enhancement,
    loading: tryOnLoading,
    error: tryOnError,
    enhanceTryOn,
    clearEnhancement,
    clearError: clearTryOnError,
  } = useAIVirtualTryOnEnhancement();

  const {
    loading: critiqueLoading,
    getPersonalityCritique,
    clearError: clearCritiqueError,
  } = useReplicateVirtualTryOn();

  const catalogGarments = React.useMemo<SelectableGarment[]>(
    () =>
      CANVAS_ITEMS.map((item) => ({
        id: item.id,
        selectionKey: `catalog:${item.id}`,
        name: item.name,
        description: item.description,
        price: item.price,
        category: item.category,
        imageUrl: item.productSrc || item.cover,
        source: "catalog",
      })),
    [],
  );
  const externalGarment = React.useMemo<SelectableGarment | null>(
    () =>
      selectedTryOnItem
        ? {
            ...selectedTryOnItem,
            selectionKey: `external:${selectedTryOnItem.id}`,
          }
        : null,
    [selectedTryOnItem],
  );
  const garmentOptions = React.useMemo(
    () => (externalGarment ? [externalGarment, ...catalogGarments] : catalogGarments),
    [catalogGarments, externalGarment],
  );


  React.useEffect(() => {
    if (!selectedTryOnItem) return;
    const key = `external:${selectedTryOnItem.id}`;
    setSelectedGarmentKey(key);
    trackTryOnGarmentSelected({
      garmentId: selectedTryOnItem.id,
      garmentSource: selectedTryOnItem.source,
      garmentCategory: selectedTryOnItem.category,
      hasImage: Boolean(selectedTryOnItem.imageUrl),
      method: "deep_link",
    });
  }, [selectedTryOnItem]);

  // Intelligent garment pre-selection — picks garment based on body type
  React.useEffect(() => {
    if (!analysis || selectedGarmentKey) return;
    const recommendedCategory = getRecommendedCategory(analysis.bodyType || "");
    let garmentToSelect = garmentOptions[0];
    if (recommendedCategory) {
      const match = garmentOptions.find((g) => g.category === recommendedCategory);
      if (match) garmentToSelect = match;
    }
    if (garmentToSelect) {
      setSelectedGarmentKey(garmentToSelect.selectionKey);
    }
  }, [analysis]);

  // Handlers
  const handlePhotoSelect = useCallback(async (file: File, qualityResult: QualityCheckResult) => {
    setSelectedPhoto(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setPhotoPrepStatus("optimizing");

    try {
      const photoData = await imageFileToDataUrl(file);
      setSelectedPhotoData(photoData);

      if (qualityResult.failCount > 0 || qualityResult.warnCount >= 2) {
        setQualityWarning("Photo quality may reduce accuracy. You can still analyze it, but a clearer full-body photo will produce better ratings.");
        return;
      }

      setQualityWarning(null);
      // Auto-analyze on upload
      await analyzePhoto(file, preferences);
    } finally {
      setPhotoPrepStatus("idle");
    }
  }, [analyzePhoto, preferences]);

  const handleAnalyzeAnyway = useCallback(async () => {
    if (!selectedPhoto) return;
    setPhotoPrepStatus("optimizing");
    setQualityWarning(null);
    try {
      await analyzePhoto(selectedPhoto, preferences);
    } finally {
      setPhotoPrepStatus("idle");
    }
  }, [analyzePhoto, preferences, selectedPhoto]);

  const handlePersonaSelect = useCallback(async (persona: StylistPersona) => {
    if (!selectedPhoto || !isPersonaUnlocked(persona, isPremium)) return;
    
    setSelectedPersona(persona);
    setShowPersonalitySelection(false);
    
    try {
      const critique = await getPersonalityCritique(selectedPhoto, persona, 'real');
      if (critique) {
        setCritiqueResult({ persona, critique });
      }
    } catch (err) {
      console.error("Error getting persona critique:", err);
    }
  }, [selectedPhoto, getPersonalityCritique, isPremium]);

  // Auto-select persona from deep-link after analysis completes
  const hasAutoSelectedPersona = React.useRef(false);
  const deepLinkSelectTimeRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (
      initialPersona &&
      analysis &&
      !critiqueResult &&
      !selectedPersona &&
      !hasAutoSelectedPersona.current
    ) {
      hasAutoSelectedPersona.current = true;
      deepLinkSelectTimeRef.current = Date.now();
      trackDeepLinkPersonaSelected({
        persona: initialPersona,
        curatorSlug: initialCuratorSlug,
        listingId: selectedTryOnItem?.id,
      });
      handlePersonaSelect(initialPersona);
    }
  }, [initialPersona, analysis, critiqueResult, selectedPersona, handlePersonaSelect, initialCuratorSlug, selectedTryOnItem]);

  // Track deep-link persona outcome when critique completes
  React.useEffect(() => {
    if (initialPersona && critiqueResult && deepLinkSelectTimeRef.current) {
      trackDeepLinkPersonaOutcome({
        persona: initialPersona,
        curatorSlug: initialCuratorSlug,
        completed: true,
        durationMs: Date.now() - deepLinkSelectTimeRef.current,
      });
    }
  }, [initialPersona, critiqueResult, initialCuratorSlug]);

  const handleShopRecommendations = useCallback(async () => {
    if (!analysis) return;

    if (typeof window !== 'undefined') {
      const takeaways = analysis.styleAdjustments || [];
      const topics = analysis.fitRecommendations.length > 0
        ? analysis.fitRecommendations.slice(0, 4)
        : (analysis.personalization || []).slice(0, 4);

      // Create a small thumbnail for the shop page
      let thumbnail = '';
      try {
        const img = new Image();
        img.src = selectedPhotoData || previewUrl || '';
        await new Promise<void>((resolve) => {
          if (img.complete) { resolve(); return; }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        });
        if (img.naturalWidth > 0) {
          const canvas = document.createElement('canvas');
          const size = 100;
          const ratio = img.naturalWidth / img.naturalHeight;
          canvas.width = ratio >= 1 ? size : Math.round(size * ratio);
          canvas.height = ratio >= 1 ? Math.round(size / ratio) : size;
          canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
          thumbnail = canvas.toDataURL('image/jpeg', 0.6);
        }
      } catch { /* non-fatal */ }

      sessionStorage.setItem('stylistAnalysis', JSON.stringify({
        bodyType: analysis.bodyType,
        measurements: analysis.measurements,
        styleRecommendations: takeaways,
        personalization: analysis.personalization,
        userPhoto: thumbnail,
        curationContext: {
          score: analysis.score || 5,
          takeaways,
          topics,
          persona: selectedPersona || undefined,
        },
      }));
      window.location.href = '/shop';
    }
  }, [analysis, previewUrl, selectedPersona, selectedPhotoData]);

  const handleReset = useCallback(() => {
    // Track abandoned deep-link persona sessions
    if (initialPersona && hasAutoSelectedPersona.current && !critiqueResult && deepLinkSelectTimeRef.current) {
      trackDeepLinkPersonaOutcome({
        persona: initialPersona,
        curatorSlug: initialCuratorSlug,
        completed: false,
        durationMs: Date.now() - deepLinkSelectTimeRef.current,
      });
      deepLinkSelectTimeRef.current = null;
    }
    setSelectedPhoto(null);
    setPreviewUrl(null);
    setSelectedPhotoData(null);
    setShowPersonalitySelection(false);
    setSelectedPersona(null);
    setCritiqueResult(null);
    setQualityWarning(null);
    setPhotoPrepStatus("idle");
    clearAnalysis();
    clearError();
    clearCritiqueError();
    clearEnhancement();
    clearTryOnError();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
  }, [
    initialPersona,
    initialCuratorSlug,
    critiqueResult,
    clearAnalysis,
    clearError,
    clearCritiqueError,
    clearEnhancement,
    clearTryOnError,
    previewUrl,
  ]);

  // Derived state
  const canShowAnalysis = Boolean(analysis && !critiqueResult && !showPersonalitySelection);
  const canShowPersonaSelection = Boolean(analysis && showPersonalitySelection && !critiqueResult);
  const personDescription = [
    `Body type: ${analysis?.bodyType || "unknown"}`,
    ...(analysis?.currentLook || []),
    ...(analysis?.fitRecommendations || []),
    ...(analysis?.styleAdjustments || []),
  ].join("\n");
  const selectedGarment =
    garmentOptions.find((item) => item.selectionKey === selectedGarmentKey) || null;
  const isPreparingPhoto = photoPrepStatus === "optimizing";
  const isBusy = loading || tryOnLoading || isPreparingPhoto;
  const selectGarment = useCallback(
    (item: SelectableGarment, method: "carousel" | "change_garment" = "carousel") => {
      setSelectedGarmentKey(item.selectionKey);
      clearEnhancement();
      trackTryOnGarmentSelected({
        garmentId: item.id,
        garmentSource: item.source,
        garmentCategory: item.category,
        hasImage: Boolean(item.imageUrl),
        method,
      });
    },
    [clearEnhancement],
  );
  const tryOnItems = React.useMemo(
    () =>
      selectedGarment
        ? [
            {
              name: selectedGarment.name,
              description: selectedGarment.description,
              imageUrl: selectedGarment.imageUrl,
            },
          ]
        : [],
    [selectedGarment],
  );
  const handleGenerateTryOn = useCallback(() => {
    if (!selectedGarment) return;
    return enhanceTryOn(
      tryOnItems,
      selectedPhotoData || undefined,
      personDescription,
      preferences,
    );
  }, [
    enhanceTryOn,
    personDescription,
    preferences,
    selectedGarment,
    selectedPhotoData,
    tryOnItems,
  ]);
  const tryOnResult = enhancement?.generatedImage
    ? {
        id: "upload-tryon-result",
        image: enhancement.generatedImage,
        description: "AI-generated outfit visualization based on your uploaded photo analysis.",
        stylingTips: enhancement.stylingTips,
        structuredTips: enhancement.structuredTips,
        providerLabel: getProviderLabel(enhancement),
      }
    : null;
  const outcomeKeyRef = React.useRef<string | null>(null);
  const errorKeyRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!enhancement) return;
    const key = [
      enhancement.provider,
      enhancement.imageConditioned,
      enhancement.fallbackReason,
      enhancement.latencyMs,
      enhancement.generatedImage?.slice(0, 32),
    ].join("|");
    if (outcomeKeyRef.current === key) return;
    outcomeKeyRef.current = key;
    trackVirtualTryOnProviderOutcome({
      provider: enhancement.provider,
      imageConditioned: Boolean(enhancement.imageConditioned),
      fallbackReason: enhancement.fallbackReason,
      latencyMs: enhancement.latencyMs,
      errorClass: enhancement.errorClass,
      garmentSource: selectedGarment?.source,
      garmentCategory: selectedGarment?.category,
      hasPersonImage: Boolean(selectedPhotoData),
      hasGarmentImage: Boolean(selectedGarment?.imageUrl),
    });
  }, [enhancement, selectedGarment, selectedPhotoData]);

  React.useEffect(() => {
    if (!tryOnError) return;
    const key = `${tryOnError}|${selectedGarment?.id || "none"}`;
    if (errorKeyRef.current === key) return;
    errorKeyRef.current = key;
    trackVirtualTryOnProviderError({
      errorClass: "ClientTryOnError",
      fallbackReason: "request_failed",
      garmentSource: selectedGarment?.source,
      garmentCategory: selectedGarment?.category,
      hasPersonImage: Boolean(selectedPhotoData),
      hasGarmentImage: Boolean(selectedGarment?.imageUrl),
    });
  }, [tryOnError, selectedGarment, selectedPhotoData]);

  return (
    <section className="py-4">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Compact mode toggle */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Button
                variant={showLiveStylist ? "default" : "outline"}
                size="sm"
                onClick={() => setShowLiveStylist(true)}
                className="rounded-full text-xs"
              >
                <Camera className="w-3.5 h-3.5 mr-1" />
                Live Camera
              </Button>
              <Button
                variant={!showLiveStylist ? "default" : "outline"}
                size="sm"
                onClick={() => setShowLiveStylist(false)}
                className="rounded-full text-xs"
              >
                <Upload className="w-3.5 h-3.5 mr-1" />
                Upload Photo
              </Button>
            </div>
          </div>

          {/* Deep-link persona banner — fades out when critique arrives or user dismisses */}
          {initialPersona && (
            <PersonaDeepLinkBanner
              persona={initialPersona}
              curatorSlug={initialCuratorSlug}
              shouldDismiss={Boolean(critiqueResult)}
            />
          )}

          {showLiveStylist ? (
            <div className="animate-fade-in">
              <LiveStylistView onBack={() => setShowLiveStylist(false)} />
            </div>
          ) : (
            <div className="animate-fade-in max-w-2xl mx-auto space-y-6">
                {!selectedPhoto && (
                  <PhotoUpload
                    onPhotoSelect={handlePhotoSelect}
                    disabled={loading}
                  />
                )}

                {selectedPhoto && previewUrl && (
                  <div className="space-y-6">
                  {/* Compact photo thumbnail bar */}
                  <div className={`flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors ${
                    isBusy ? "border-primary/25 shadow-sm shadow-primary/10" : "border-border"
                  }`}>
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg">
                      <img
                        src={previewUrl}
                        alt="Your photo"
                        className="h-full w-full object-cover"
                      />
                      {isBusy && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div>
                        <p className="text-xs font-medium">
                          {analysis
                            ? "Analysis complete"
                            : isPreparingPhoto
                              ? "Preparing your style scan"
                              : loading
                                ? "OnPoint is styling your profile"
                                : "Photo ready"}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {analysis?.bodyType
                            ? `Body type: ${analysis.bodyType}`
                            : isPreparingPhoto
                              ? "Secure resize in progress."
                              : loading
                                ? "Reading silhouette, color, and fit cues."
                                : "Analysis will start automatically."}
                        </p>
                      </div>
                      {(loading || isPreparingPhoto) && (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[10px] text-primary">
                            <Sparkles className="h-3 w-3" />
                            <span>{isPreparingPhoto ? "Optimizing upload" : "Building your fit profile"}</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div className="h-full w-2/3 rounded-full bg-primary/70 animate-pulse" />
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={handleReset}
                      className="shrink-0 rounded-md border border-border px-2.5 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      Change
                    </button>
                  </div>
                  {/* Error Display */}
                  {error && (
                    <div className="border border-destructive rounded-lg p-4 bg-destructive/10">
                      <p className="text-sm font-medium text-destructive">
                        Analysis paused
                      </p>
                      <p className="mt-1 text-xs text-destructive/90">{error}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearError}
                        className="mt-3"
                      >
                        Dismiss
                      </Button>
                    </div>
                  )}

                  {tryOnError && (
                    <div className="border border-destructive rounded-lg p-4 bg-destructive/10">
                      <p className="text-destructive text-sm">{tryOnError}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearTryOnError}
                        className="mt-3"
                      >
                        Dismiss
                      </Button>
                    </div>
                  )}

                  {qualityWarning && selectedPhoto && !analysis && (
                    <div className="border border-amber-500/30 rounded-lg p-4 bg-amber-500/10">
                      <p className="text-amber-700 dark:text-amber-300 text-sm">
                        {qualityWarning}
                      </p>
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleAnalyzeAnyway}
                          disabled={loading || isPreparingPhoto}
                        >
                          {isPreparingPhoto ? "Optimizing..." : "Analyze Anyway"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleReset}>
                          Choose Better Photo
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Branded loading state while photo optimization or analysis runs */}
                  {(loading || isPreparingPhoto) && !analysis && !qualityWarning && (
                    <StyleScanLoadingCard previewUrl={previewUrl} isPreparingPhoto={isPreparingPhoto} />
                  )}

                  {/* Analysis Results */}
                    {(tryOnResult || tryOnLoading) && previewUrl && (
                      <div className="animate-fade-in">
                        <TryOnResult
                          result={
                            tryOnResult || {
                              id: "upload-tryon-loading",
                              image: "",
                              description: "Generating your AI try-on visualization.",
                              providerLabel: selectedPhotoData && selectedGarment?.imageUrl
                                ? "Image-conditioned try-on"
                                : "AI generated visualization",
                            }
                          }
                          loading={tryOnLoading}
                          originalPhotoUrl={previewUrl}
                          onBack={clearEnhancement}
                          onRetry={handleGenerateTryOn}
                          onChangeGarment={() => {
                            clearEnhancement();
                            if (selectedGarment) {
                              trackTryOnGarmentSelected({
                                garmentId: selectedGarment.id,
                                garmentSource: selectedGarment.source,
                                garmentCategory: selectedGarment.category,
                                hasImage: Boolean(selectedGarment.imageUrl),
                                method: "change_garment",
                              });
                            }
                          }}
                        />
                      </div>
                    )}

                    {!tryOnResult && !tryOnLoading && canShowAnalysis && (
                      <div className="animate-fade-in">
                        <AnalysisResults
                          analysis={analysis!}
                          previewUrl={previewUrl}
                          selectedGarment={selectedGarment}
                          onCritiqueModeSelection={() => setShowPersonalitySelection(true)}
                          onShopRecommendations={handleShopRecommendations}
                          preferences={preferences}
                        />
                        <GarmentPicker
                          garmentOptions={garmentOptions}
                          selectedGarmentKey={selectedGarmentKey}
                          onSelectGarment={selectGarment}
                          onGenerateTryOn={handleGenerateTryOn}
                          tryOnLoading={tryOnLoading}
                        />
                      </div>
                    )}

                  {/* Persona Selection */}
                    {canShowPersonaSelection && (
                      <div className="animate-fade-in border rounded-2xl p-6 bg-gradient-to-br from-primary/5 to-accent/5">
                        <h3 className="text-xl font-bold mb-2">Choose Your Stylist</h3>
                        <p className="text-sm text-muted-foreground mb-6">
                          Pick a persona to get personalized fashion critique
                        </p>
                        
                        {/* Free Personas */}
                        <div className="mb-6">
                          <p className="text-xs font-medium text-muted-foreground mb-3">FREE STYLISTS</p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {FREE_PERSONAS.map((persona) => (
                              <PersonalityCard
                                key={persona}
                                persona={persona}
                                isSelected={selectedPersona === persona}
                                onSelect={handlePersonaSelect}
                                disabled={loading || critiqueLoading}
                                isLocked={false}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Premium Personas */}
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-medium text-muted-foreground">PREMIUM STYLISTS</p>
                            {!isPremium && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/20 text-accent font-bold">
                                Upgrade to unlock
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {PREMIUM_PERSONAS.map((persona) => (
                              <PersonalityCard
                                key={persona}
                                persona={persona}
                                isSelected={selectedPersona === persona}
                                onSelect={handlePersonaSelect}
                                disabled={loading || critiqueLoading}
                                isLocked={!isPremium}
                              />
                            ))}
                          </div>
                        </div>

                        {!isPremium && !premiumLoading && (
                          <div className="mt-4 p-3 rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
                            <p className="text-xs text-muted-foreground mb-2">
                              Unlock premium stylists and unlimited critiques with OnPoint Premium.
                            </p>
                            <a
                              href="/pricing"
                              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                            >
                              Upgrade now <span aria-hidden="true">→</span>
                            </a>
                          </div>
                        )}
                        <div className="flex justify-center mt-4">
                          <Button
                            variant="outline"
                            onClick={() => setShowPersonalitySelection(false)}
                            disabled={loading || critiqueLoading}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                  {/* Critique Result */}
                    {critiqueResult && (
                      <div className="animate-fade-in">
                        <CritiqueResult
                          persona={critiqueResult.persona}
                          critique={critiqueResult.critique}
                          mode="real"
                          onBack={() => setCritiqueResult(null)}
                          onTryDifferentMode={() => {
                            setCritiqueResult(null);
                            setShowPersonalitySelection(true);
                          }}
                        />
                        
                        {/* Shop Button after critique */}
                        <div className="mt-4">
                          <Button
                            onClick={handleShopRecommendations}
                            className="w-full bg-gradient-to-r from-primary to-accent"
                            size="lg"
                          >
                            Let Agent Shop for Me
                          </Button>
                        </div>
                      </div>
                    )}

                  {/* Welcome Message removed — upload area is self-explanatory */}
                </div>
                )}
              </div>
            )}
        </div>
      </div>
    </section>
  );
}
