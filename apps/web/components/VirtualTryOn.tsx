"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@repo/ui/button";
import { Upload, Camera, Sparkles } from "lucide-react";
import dynamic from "next/dynamic";
// framer-motion removed — using CSS transitions instead
import { useVirtualTryOn } from "@repo/ai-client";
import { useAIVirtualTryOnEnhancement } from "@repo/ai-client";
import { useReplicateVirtualTryOn } from "@repo/ai-client";
import { imageFileToDataUrl } from "@repo/ai-client";
import type { StylistPersona } from "@repo/ai-client";
import type { QualityCheckResult } from "./VirtualTryOn/usePhotoQualityCheck";

import { FREE_PERSONAS, PREMIUM_PERSONAS, isPersonaUnlocked } from "../lib/utils/persona-config";
import { usePremiumStatus } from "../hooks/use-premium-status";
import { useUserPreferences } from "../hooks/useUserPreferences";
import { CANVAS_ITEMS } from "@onpoint/shared-types";
import type { TryOnSelection } from "../lib/utils/try-on-selection";
import {
  trackTryOnGarmentSelected,
  trackVirtualTryOnProviderError,
  trackVirtualTryOnProviderOutcome,
} from "../lib/utils/analytics";

import {
  PhotoUpload,
  AnalysisResults,
  AnalysisSkeleton,
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

interface VirtualTryOnProps {
  selectedTryOnItem?: TryOnSelection | null;
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

export function VirtualTryOn({ selectedTryOnItem }: VirtualTryOnProps) {
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

  const { isPremium, loading: premiumLoading } = usePremiumStatus();
  const { preferences } = useUserPreferences();

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
    const photoData = await imageFileToDataUrl(file);
    setSelectedPhotoData(photoData);

    if (qualityResult.failCount > 0 || qualityResult.warnCount >= 2) {
      setQualityWarning("Photo quality may reduce accuracy. You can still analyze it, but a clearer full-body photo will produce better ratings.");
      return;
    }

    setQualityWarning(null);
    // Auto-analyze on upload
    await analyzePhoto(file, preferences);
  }, [analyzePhoto, preferences]);

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

  const handleShopRecommendations = useCallback(() => {
    if (!analysis) return;
    
    // Store analysis for shop page
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('stylistAnalysis', JSON.stringify({
        bodyType: analysis.bodyType,
        measurements: analysis.measurements,
        styleRecommendations: (analysis as any).styleRecommendations || analysis.styleAdjustments,
        personalization: (analysis as any).personalization,
      }));
      window.location.href = '/shop';
    }
  }, [analysis]);

  const handleReset = useCallback(() => {
    setSelectedPhoto(null);
    setPreviewUrl(null);
    setSelectedPhotoData(null);
    setShowPersonalitySelection(false);
    setSelectedPersona(null);
    setCritiqueResult(null);
    setQualityWarning(null);
    clearAnalysis();
    clearError();
    clearCritiqueError();
    clearEnhancement();
    clearTryOnError();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
  }, [
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
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg">
                      <img
                        src={previewUrl}
                        alt="Your photo"
                        className="h-full w-full object-cover"
                      />
                      {(loading || tryOnLoading) && (
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
                            : loading
                              ? "Reading silhouette, color, and fit cues"
                              : "Photo ready"}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {analysis?.bodyType
                            ? `Body type: ${analysis.bodyType}`
                            : loading
                              ? "This usually takes a few seconds."
                              : "Analysis will start automatically."}
                        </p>
                      </div>
                      {loading && (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[10px] text-primary">
                            <Sparkles className="h-3 w-3" />
                            <span>Building your fit profile</span>
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
                          onClick={() => {
                            setQualityWarning(null);
                            analyzePhoto(selectedPhoto, preferences);
                          }}
                          disabled={loading}
                        >
                          Analyze Anyway
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleReset}>
                          Choose Better Photo
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Skeleton loading while analysis runs */}
                  {loading && !analysis && !qualityWarning && (
                    <div className="space-y-4 animate-pulse">
                      <AnalysisSkeleton showActions={false} />

                      {/* Garment picker skeleton */}
                      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="h-3 w-32 rounded bg-muted-foreground/20" />
                          <div className="h-4 w-10 rounded-full bg-muted-foreground/20" />
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_120px_120px]">
                          <div className="h-9 rounded-md bg-muted-foreground/10" />
                          <div className="h-9 rounded-md bg-muted-foreground/10" />
                          <div className="h-9 rounded-md bg-muted-foreground/10" />
                        </div>
                        <div className="mt-3 flex gap-2 overflow-hidden">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="w-28 shrink-0">
                              <div className="aspect-square rounded-lg bg-muted-foreground/10" />
                              <div className="h-3 w-16 rounded bg-muted-foreground/20 mt-2" />
                              <div className="h-2 w-12 rounded bg-muted-foreground/20 mt-1" />
                            </div>
                          ))}
                        </div>
                        <div className="mt-4">
                          <div className="h-10 w-full rounded-lg bg-muted-foreground/10" />
                        </div>
                      </div>
                    </div>
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
