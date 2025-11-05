"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@repo/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Sparkles, MessageCircle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useVirtualTryOn, useAIVirtualTryOnEnhancement } from "@repo/ai-client";
import { useReplicateVirtualTryOn } from "@repo/ai-client";
import type { VirtualTryOnAnalysis, StylistPersona, CritiqueMode } from "@repo/ai-client";

import { useSocialActivities } from "../lib/hooks/useMemoryAPI";

import {
  PhotoUpload,
  AnalysisResults,
  ActionHub,
  PhotoPreview,
  ScanComplete,
  WelcomeCard,
  CritiqueModeCard,
  PersonalityCard,
  TryOnResult,
  CritiqueResult,
  FashionAnalysis,
} from "./VirtualTryOn/index";

import { PersonDescriptionEditor } from "./VirtualTryOn/PersonDescriptionEditor";



export function VirtualTryOn() {
const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
const [previewUrl, setPreviewUrl] = useState<string | null>(null);
const [scanComplete, setScanComplete] = useState(false);
const [outfitItems] = useState([
{ name: "Classic Blazer", description: "Navy wool blazer with gold buttons, structured shoulders", type: "outerwear" },
{ name: "Silk Blouse", description: "Cream silk button-up blouse with subtle pattern", type: "top" },
{ name: "Tailored Trousers", description: "Black wool trousers with sharp creases and slim fit", type: "bottom" },
]);

const [fashionAnalysis, setFashionAnalysis] = useState<any | null>(null);
const [showAnalysis, setShowAnalysis] = useState(false);
const [tryOnResult, setTryOnResult] = useState<any | null>(null);
const [showPersonalitySelection, setShowPersonalitySelection] = useState(false);
const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
const [selectedCritiqueMode, setSelectedCritiqueMode] = useState<CritiqueMode>('real');
  const [personDescription, setPersonDescription] = useState<string>('');
  const [isAnalyzingPerson, setIsAnalyzingPerson] = useState(false);
  const [showPersonDescription, setShowPersonDescription] = useState(false);

  // Use the enhancement hook
  const { enhancement, enhanceTryOn, loading: enhancementLoading, error: enhancementError } = useAIVirtualTryOnEnhancement();
  const [showCritiqueModeSelection, setShowCritiqueModeSelection] = useState(false);
  const [critiqueResult, setCritiqueResult] = useState<{ persona: StylistPersona; critique: string; mode: CritiqueMode } | null>(null);
  // const [showCamera, setShowCamera] = useState(false); // Not currently used

  const {
    analysis,
    loading,
    error,
    analyzePhoto,
    clearAnalysis,
    clearError,
  } = useVirtualTryOn();

  const {
    result: replicateResult,
    loading: replicateLoading,
    error: replicateError,
    processVirtualTryOn,
    analyzeFashionImage,
    getPersonalityCritique,
    clearResult,
    clearError: clearReplicateError,
  } = useReplicateVirtualTryOn();

  const { recordTryOn } = useSocialActivities();

  const hasInput = Boolean(selectedPhoto || scanComplete);
  const canShowAnalysisCard = Boolean(analysis && !tryOnResult && !showPersonalitySelection && !showAnalysis && !critiqueResult && !showPersonDescription);
  const canShowActionHub = hasInput && !analysis && !critiqueResult && !tryOnResult && !showAnalysis && !showCritiqueModeSelection && !showPersonalitySelection && !showPersonDescription;
  const canShowPersonDescription = Boolean(showPersonDescription && !tryOnResult && !critiqueResult);


  const handlePhotoSelect = useCallback(
    async (file: File) => {
      setSelectedPhoto(file);

      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);

      // Don't automatically analyze - let user choose what to do
      // await analyzePhoto(file);
    },
    [],
  );

  const handleReanalyze = useCallback(async () => {
    if (selectedPhoto) {
      await analyzePhoto(selectedPhoto);
    }
  }, [analyzePhoto, selectedPhoto]);

  const handleScanComplete = useCallback(async () => {
    setScanComplete(true);

    // Use actual photo analysis instead of mock file
    if (selectedPhoto) {
      await analyzePhoto(selectedPhoto);
    } else {
      // For body scan without photo, generate analysis based on scan data
      try {
        const response = await fetch('/api/ai/virtual-tryon', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'body-analysis',
            data: {
              description: 'Body scan completed with precise measurements',
              scanType: 'body-scan'
            }
          })
        });

        if (response.ok) {
          await response.json();
          // The analysis will be set through the API response
        }
      } catch (error) {
        console.error('Body scan analysis error:', error);
      }
    }
  }, [analyzePhoto, selectedPhoto]);

  const handleAnalyzePerson = useCallback(async () => {
    if (!selectedPhoto) return;

    setIsAnalyzingPerson(true);
    setPersonDescription('');

    try {
      // Convert photo to base64 for analysis
      const photoData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(selectedPhoto);
      });

      const response = await fetch('/api/ai/analyze-person', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoData })
      });

      if (response.ok) {
        const data = await response.json();
        setPersonDescription(data.description);
        setShowPersonDescription(true);
      } else {
        console.error('Person analysis failed');
        alert('Failed to analyze person. Please try again.');
      }
    } catch (error) {
      console.error('Person analysis error:', error);
      alert('Failed to analyze person. Please try again.');
    } finally {
      setIsAnalyzingPerson(false);
    }
  }, [selectedPhoto]);

  const handleTryOnDesign = useCallback(async () => {
    if (!analysis || !selectedPhoto || !personDescription) return;

    // Record social activity for try-on
    const outfitId = `outfit-${Date.now()}`; // Generate unique outfit ID
    recordTryOn(outfitId);

    // Convert photo to base64 for analysis
    const photoData = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(selectedPhoto);
    });

    // Start the enhancement process with the person's description
    await enhanceTryOn(outfitItems, photoData, personDescription);
  }, [analysis, enhanceTryOn, outfitItems, recordTryOn, selectedPhoto, personDescription]);

  // Watch for enhancement completion and set try-on result
  React.useEffect(() => {
    if (enhancement?.generatedImage) {
      const outfitId = `outfit-${Date.now()}`;
      setTryOnResult({
        id: outfitId,
        image: enhancement.generatedImage,
        description: enhancement.enhancedOutfit.map(item => item.name).join(', '),
        stylingTips: enhancement.stylingTips,
        timestamp: Date.now()
      });
    }
  }, [enhancement]);

  // New function for fashion analysis
  const handleFashionAnalysis = useCallback(async () => {
    if (!selectedPhoto) return;

    try {
      const analysis = await analyzeFashionImage(selectedPhoto);
      if (analysis) {
        setFashionAnalysis(analysis);
        setShowAnalysis(true);
      }
    } catch (err) {
      console.error("Fashion analysis error:", err);
    }
  }, [selectedPhoto, analyzeFashionImage]);

  const handlePersonaSelect = useCallback((persona: string) => {
    setSelectedPersona(persona);
    setShowPersonalitySelection(false);
  }, []);



  const handleReset = useCallback(() => {
    setSelectedPhoto(null);
    setPreviewUrl(null);
    setScanComplete(false);
    // setShowCamera(false); // Not currently used
    setTryOnResult(null);
    setFashionAnalysis(null);
    setShowAnalysis(false);
    setShowPersonalitySelection(false);
    setShowCritiqueModeSelection(false);
    setSelectedPersona(null);
    setSelectedCritiqueMode('real');
    setCritiqueResult(null);
    setPersonDescription('');
    setIsAnalyzingPerson(false);
    setShowPersonDescription(false);
    clearAnalysis();
    clearError();
    clearReplicateError();
    clearResult();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
  }, [clearAnalysis, clearError, clearReplicateError, clearResult, previewUrl]);

  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Sparkles className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Stylist
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg leading-relaxed">
            Get personalized fashion analysis, body measurements, and AI-powered styling recommendations.
            Upload a photo or use our body scanning technology for tailored fashion insights.
          </p>
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <div className="space-y-6">
              {/* Upload Methods */}
              {!selectedPhoto && !scanComplete && (
                <PhotoUpload
                  onPhotoSelect={handlePhotoSelect}
                  disabled={loading}
                />
              )}

              {/* Photo Preview */}
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

              {/* Scan Complete Indicator */}
              {scanComplete && !selectedPhoto && (
                <ScanComplete
                  onReset={handleReset}
                  loading={loading}
                />
              )}
            </div>
            <div className="space-y-6">
              {/* Error Display */}
          {error && (
            <Card className="border-destructive">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="text-destructive">⚠️</div>
                  <div className="flex-1">
                    <p className="text-destructive font-medium">
                      Analysis Error
                    </p>
                    <p className="text-destructive/80 text-sm mt-1">{error}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearError}
                      className="mt-3"
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Analysis Results */}
          <AnimatePresence mode="wait">
            {canShowAnalysisCard && analysis && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <AnalysisResults
                  analysis={analysis}
                  onAnalyzePerson={handleAnalyzePerson}
                  onCritiqueModeSelection={() => setShowCritiqueModeSelection(true)}
                  onFashionAnalysis={handleFashionAnalysis}
                  isAnalyzingPerson={isAnalyzingPerson}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Person Description Editor */}
          <AnimatePresence mode="wait">
            {canShowPersonDescription && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <PersonDescriptionEditor
                  description={personDescription}
                  onDescriptionChange={setPersonDescription}
                  onConfirm={handleTryOnDesign}
                  onCancel={() => {
                    setShowPersonDescription(false);
                    setPersonDescription('');
                  }}
                  loading={enhancementLoading}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Critique Mode Selection */}
          <AnimatePresence mode="wait">
            {showCritiqueModeSelection && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageCircle className="h-5 w-5" />
                      Choose Your Critique Style
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      How would you like your fashion feedback delivered?
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <CritiqueModeCard
                          mode="roast"
                          isSelected={selectedCritiqueMode === "roast"}
                          onSelect={setSelectedCritiqueMode}
                          disabled={loading}
                        />
                        <CritiqueModeCard
                          mode="flatter"
                          isSelected={selectedCritiqueMode === "flatter"}
                          onSelect={setSelectedCritiqueMode}
                          disabled={loading}
                        />
                        <CritiqueModeCard
                          mode="real"
                          isSelected={selectedCritiqueMode === "real"}
                          onSelect={setSelectedCritiqueMode}
                          disabled={loading}
                        />
                      </div>
                      <div className="flex gap-3 justify-center">
                        <Button
                          variant="outline"
                          onClick={() => setShowCritiqueModeSelection(false)}
                          disabled={loading}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() => {
                            setShowCritiqueModeSelection(false);
                            setShowPersonalitySelection(true);
                          }}
                          disabled={loading}
                        >
                          Continue to Stylist Selection
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Personality Selection */}
          <AnimatePresence mode="wait">
            {showPersonalitySelection && !showCritiqueModeSelection && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageCircle className="h-5 w-5" />
                      Select Stylist Persona
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Choose a personality to critique your outfit
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <PersonalityCard
                          persona="luxury"
                          isSelected={selectedPersona === "luxury"}
                          onSelect={handlePersonaSelect}
                          disabled={loading || replicateLoading}
                        />
                        <PersonalityCard
                          persona="streetwear"
                          isSelected={selectedPersona === "streetwear"}
                          onSelect={handlePersonaSelect}
                          disabled={loading || replicateLoading}
                        />
                        <PersonalityCard
                          persona="sustainable"
                          isSelected={selectedPersona === "sustainable"}
                          onSelect={handlePersonaSelect}
                          disabled={loading || replicateLoading}
                        />
                        <PersonalityCard
                          persona="edina"
                          isSelected={selectedPersona === "edina"}
                          onSelect={handlePersonaSelect}
                          disabled={loading || replicateLoading}
                        />
                        <PersonalityCard
                          persona="miranda"
                          isSelected={selectedPersona === "miranda"}
                          onSelect={handlePersonaSelect}
                          disabled={loading || replicateLoading}
                        />
                        <PersonalityCard
                          persona="shaft"
                          isSelected={selectedPersona === "shaft"}
                          onSelect={handlePersonaSelect}
                          disabled={loading || replicateLoading}
                        />
                      </div>
                      <div className="flex justify-center">
                        <Button
                          variant="outline"
                          onClick={() => setShowPersonalitySelection(false)}
                          disabled={loading || replicateLoading}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Fashion Analysis */}
          <AnimatePresence mode="wait">
            {showAnalysis && fashionAnalysis && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <FashionAnalysis
                  analysis={fashionAnalysis}
                  onBack={() => setShowAnalysis(false)}
                />
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
                  mode={critiqueResult.mode}
                  onBack={() => setCritiqueResult(null)}
                  onTryDifferentMode={() => {
                    setCritiqueResult(null);
                    setShowCritiqueModeSelection(true);
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Try-On Result */}
          <AnimatePresence mode="wait">
          {(tryOnResult || enhancementLoading) && !critiqueResult && (
          <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          >
          <TryOnResult
          result={tryOnResult || { id: 'loading', image: '' }}
          onBack={() => {
            setTryOnResult(null);
              // Also clear any loading state if needed
             }}
                loading={enhancementLoading && !tryOnResult}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Fashion Analysis Result */}
          <AnimatePresence mode="wait">
            {showAnalysis && fashionAnalysis && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <FashionAnalysis
                  analysis={fashionAnalysis}
                  onBack={() => {
                    setFashionAnalysis(null);
                    setShowAnalysis(false);
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {canShowActionHub && (
            <ActionHub
              analysis={analysis}
              loading={loading}
              hasInput={hasInput}
              scanComplete={scanComplete}
              selectedPhoto={selectedPhoto}
              onTryOnDesign={handleTryOnDesign}
              onBodyScan={handleScanComplete}
              onCritiqueModeSelection={() => setShowCritiqueModeSelection(true)}
              onFashionAnalysis={handleFashionAnalysis}
            />
          )}

              {/* Getting Started Message */}
              <WelcomeCard hasInput={hasInput} loading={loading} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

