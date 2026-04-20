"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@repo/ui/button";
import { Sparkles, Upload, Camera } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useVirtualTryOn } from "@repo/ai-client";
import { useReplicateVirtualTryOn } from "@repo/ai-client";
import type { StylistPersona } from "@repo/ai-client";

import { getAgentApiUrl } from "../lib/utils/agent-api";
import { FREE_PERSONAS, PREMIUM_PERSONAS, isPersonaUnlocked } from "../lib/utils/persona-config";

import {
  PhotoUpload,
  AnalysisResults,
  PhotoPreview,
  PersonalityCard,
  CritiqueResult,
  LiveStylistView,
} from "./VirtualTryOn/index";

export function VirtualTryOn() {
  // Core state
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPersonalitySelection, setShowPersonalitySelection] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<StylistPersona | null>(null);
  const [critiqueResult, setCritiqueResult] = useState<{ persona: StylistPersona; critique: string } | null>(null);
  const [showLiveStylist, setShowLiveStylist] = useState(true); // Default to live AR
  const [hasPremium] = useState(false); // TODO: Connect to subscription system

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
    loading: critiqueLoading,
    getPersonalityCritique,
    clearError: clearCritiqueError,
  } = useReplicateVirtualTryOn();

  // Handlers
  const handlePhotoSelect = useCallback(async (file: File) => {
    setSelectedPhoto(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    
    // Auto-analyze on upload
    await analyzePhoto(file);
  }, [analyzePhoto]);

  const handleReanalyze = useCallback(async () => {
    if (selectedPhoto) {
      await analyzePhoto(selectedPhoto);
    }
  }, [analyzePhoto, selectedPhoto]);

  const handlePersonaSelect = useCallback(async (persona: StylistPersona) => {
    if (!selectedPhoto || !isPersonaUnlocked(persona, hasPremium)) return;
    
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
  }, [selectedPhoto, getPersonalityCritique, hasPremium]);

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
    setShowPersonalitySelection(false);
    setSelectedPersona(null);
    setCritiqueResult(null);
    clearAnalysis();
    clearError();
    clearCritiqueError();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
  }, [clearAnalysis, clearError, clearCritiqueError, previewUrl]);

  // Derived state
  const hasInput = Boolean(selectedPhoto);
  const canShowAnalysis = Boolean(analysis && !critiqueResult && !showPersonalitySelection);
  const canShowPersonaSelection = Boolean(analysis && showPersonalitySelection && !critiqueResult);

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
                      loading={loading}
                      analysis={analysis}
                      onReset={handleReset}
                      onReanalyze={handleReanalyze}
                      onAnalyze={() => selectedPhoto && analyzePhoto(selectedPhoto)}
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

                  {/* Analysis Results */}
                  <AnimatePresence mode="wait">
                    {canShowAnalysis && (
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
                        />
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
                            {!hasPremium && (
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
                                isLocked={!hasPremium}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="flex justify-center mt-6">
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
