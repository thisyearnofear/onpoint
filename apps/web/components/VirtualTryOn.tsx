"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@repo/ui/button";
import { Check, Sparkles, Upload, Camera } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useVirtualTryOn } from "@repo/ai-client";
import { useAIVirtualTryOnEnhancement } from "@repo/ai-client";
import { useReplicateVirtualTryOn } from "@repo/ai-client";
import type { StylistPersona } from "@repo/ai-client";
import type { QualityCheckResult } from "./VirtualTryOn/usePhotoQualityCheck";

import { FREE_PERSONAS, PREMIUM_PERSONAS, isPersonaUnlocked } from "../lib/utils/persona-config";
import { usePremiumStatus } from "../hooks/use-premium-status";
import { useUserPreferences } from "../hooks/useUserPreferences";
import { CANVAS_ITEMS } from "@onpoint/shared-types";
import type { TryOnSelection } from "../lib/utils/try-on-selection";

import {
  PhotoUpload,
  AnalysisResults,
  PhotoPreview,
  PersonalityCard,
  CritiqueResult,
  LiveStylistView,
  TryOnResult,
} from "./VirtualTryOn/index";

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

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface VirtualTryOnProps {
  selectedTryOnItem?: TryOnSelection | null;
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
  const [selectedCatalogItemId, setSelectedCatalogItemId] = useState<string | null>(null);
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

  // Handlers
  const handlePhotoSelect = useCallback(async (file: File, qualityResult: QualityCheckResult) => {
    setSelectedPhoto(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    const photoData = await fileToDataUrl(file);
    setSelectedPhotoData(photoData);

    if (qualityResult.failCount > 0 || qualityResult.warnCount >= 2) {
      setQualityWarning("Photo quality may reduce accuracy. You can still analyze it, but a clearer full-body photo will produce better ratings.");
      return;
    }

    setQualityWarning(null);
    // Auto-analyze on upload
    await analyzePhoto(file, preferences);
  }, [analyzePhoto, preferences]);

  const handleReanalyze = useCallback(async () => {
    if (selectedPhoto) {
      await analyzePhoto(selectedPhoto, preferences);
    }
  }, [analyzePhoto, selectedPhoto, preferences]);

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
  const hasInput = Boolean(selectedPhoto);
  const canShowAnalysis = Boolean(analysis && !critiqueResult && !showPersonalitySelection);
  const canShowPersonaSelection = Boolean(analysis && showPersonalitySelection && !critiqueResult);
  const personDescription = [
    `Body type: ${analysis?.bodyType || "unknown"}`,
    ...(analysis?.currentLook || []),
    ...(analysis?.fitRecommendations || []),
    ...(analysis?.styleAdjustments || []),
  ].join("\n");
  const selectedCatalogItem =
    CANVAS_ITEMS.find((item) => item.id === selectedCatalogItemId) || null;
  const selectedGarment =
    selectedTryOnItem ||
    (selectedCatalogItem
      ? {
          id: selectedCatalogItem.id,
          name: selectedCatalogItem.name,
          description: selectedCatalogItem.description,
          price: selectedCatalogItem.price,
          category: selectedCatalogItem.category,
          imageUrl: selectedCatalogItem.productSrc || selectedCatalogItem.cover,
          source: "catalog",
        }
      : null);
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

          <AnimatePresence mode="wait">
            {showLiveStylist ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
              >
                <LiveStylistView onBack={() => setShowLiveStylist(false)} />
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]"
              >
                {/* Left Column - Photo Upload */}
                <div className="space-y-6">
                  {!selectedPhoto && (
                    <PhotoUpload
                      onPhotoSelect={handlePhotoSelect}
                      disabled={loading}
                    />
                  )}

                  {selectedPhoto && previewUrl && (
                    <PhotoPreview
                      previewUrl={previewUrl}
                      loading={loading || tryOnLoading}
                      analysis={analysis}
                      onReset={handleReset}
                      onReanalyze={handleReanalyze}
                      onAnalyze={() => selectedPhoto && analyzePhoto(selectedPhoto, preferences)}
                    />
                  )}
                </div>

                {/* Right Column - Results */}
                <div className="space-y-6">
                  {/* Error Display */}
                  {error && (
                    <div className="border border-destructive rounded-lg p-4 bg-destructive/10">
                      <p className="text-destructive text-sm">{error}</p>
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

                  {/* Analysis Results */}
                  <AnimatePresence mode="wait">
                    {(tryOnResult || tryOnLoading) && previewUrl && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                      >
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
                        />
                      </motion.div>
                    )}

                    {!tryOnResult && !tryOnLoading && canShowAnalysis && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                      >
                        <AnalysisResults
                          analysis={analysis!}
                          onCritiqueModeSelection={() => setShowPersonalitySelection(true)}
                          onShopRecommendations={handleShopRecommendations}
                          preferences={preferences}
                        />
                        <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-semibold text-primary">
                              {selectedTryOnItem ? "Selected for try-on" : "Choose a garment"}
                            </p>
                            <span className="rounded-full border border-primary/20 px-2 py-0.5 text-[10px] font-medium text-primary">
                              {selectedGarment ? "Ready" : "Required"}
                            </span>
                          </div>
                          {selectedGarment ? (
                            <div className="mt-2 flex gap-3">
                              {selectedGarment.imageUrl && (
                                <img
                                  src={selectedGarment.imageUrl}
                                  alt={selectedGarment.name}
                                  className="h-16 w-16 rounded-md object-cover"
                                />
                              )}
                              <div className="min-w-0">
                                <p className="text-sm font-medium">
                                  {selectedGarment.name}
                                </p>
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {selectedGarment.description}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                              {CANVAS_ITEMS.slice(0, 8).map((item) => {
                                const imageUrl = item.productSrc || item.cover;
                                const isSelected = item.id === selectedCatalogItemId;
                                return (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setSelectedCatalogItemId(item.id)}
                                    className={`relative w-28 shrink-0 rounded-lg border bg-background p-2 text-left transition-colors ${
                                      isSelected
                                        ? "border-primary bg-primary/5"
                                        : "border-border hover:border-primary/40"
                                    }`}
                                  >
                                    <div className="aspect-square overflow-hidden rounded-md bg-muted">
                                      {imageUrl ? (
                                        <img
                                          src={imageUrl}
                                          alt={item.name}
                                          className="h-full w-full object-cover"
                                        />
                                      ) : null}
                                    </div>
                                    <p className="mt-2 truncate text-xs font-medium">
                                      {item.name}
                                    </p>
                                    {isSelected && (
                                      <span className="absolute right-1.5 top-1.5 rounded-full bg-primary p-1 text-primary-foreground">
                                        <Check className="h-3 w-3" />
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <div className="mt-4">
                          <Button
                            className="w-full bg-gradient-to-r from-primary to-accent"
                            disabled={tryOnLoading || !selectedGarment}
                            onClick={handleGenerateTryOn}
                          >
                            <Sparkles className="h-4 w-4 mr-2" />
                            {tryOnLoading ? "Generating Try-On..." : "Generate AI Try-On"}
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Persona Selection */}
                  <AnimatePresence mode="wait">
                    {canShowPersonaSelection && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                        className="border rounded-2xl p-6 bg-gradient-to-br from-primary/5 to-accent/5"
                      >
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
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Critique Result */}
                  <AnimatePresence mode="wait">
                    {critiqueResult && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                      >
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
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Welcome Message removed — upload area is self-explanatory */}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
