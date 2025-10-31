"use client";

import React, { useState, useCallback, useRef } from "react";
import { Button } from "@repo/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Badge } from "@repo/ui/badge";
import { Progress } from "@repo/ui/progress";
import {
  Camera,
  Upload,
  Sparkles,
  RefreshCw,
  User,
  Scan,
  CheckCircle,
  X,
  Shirt,
  MessageCircle,
  Crown,
  Zap,
  Leaf,
  Sparkles as SparklesIcon,
  Star,
  ShoppingBag,
  Eye,
} from "lucide-react";
import { useVirtualTryOn } from "@repo/ai-client";
import { useReplicateVirtualTryOn } from "@repo/ai-client";
import type { VirtualTryOnAnalysis, StylistPersona } from "@repo/ai-client";

interface PhotoUploadProps {
  onPhotoSelect: (file: File) => void;
  disabled?: boolean;
}

function PhotoUpload({ onPhotoSelect, disabled }: PhotoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0] && files[0].type.startsWith("image/")) {
        onPhotoSelect(files[0]);
      }
    },
    [onPhotoSelect],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0 && files[0]) {
        onPhotoSelect(files[0]);
      }
    },
    [onPhotoSelect],
  );

  return (
    <Card>
      <CardHeader>
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
          <Camera className="h-8 w-8 text-primary" />
        </div>
        <CardTitle className="text-center text-xl">Upload Photo</CardTitle>
        <p className="text-muted-foreground text-center">
          Use an existing photo for try-on
        </p>
      </CardHeader>
      <CardContent>
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            disabled
              ? "border-muted opacity-50"
              : "border-muted-foreground/20 hover:border-primary/30"
          }`}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => !disabled && fileInputRef.current?.click()}
        >
          <Camera className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-sm text-muted-foreground mb-4">
            Drag & drop your photo here or click to browse
          </p>
          <Button variant="outline" disabled={disabled}>
            <Upload className="h-4 w-4 mr-2" />
            Select Photo
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            disabled={disabled}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function BodyScanSimulation({
  onScanComplete,
  disabled,
}: {
  onScanComplete: () => void;
  disabled?: boolean;
}) {
  const [scanProgress, setScanProgress] = useState(0);
  const [isScanning, setIsScanning] = useState(false);

  const startScan = useCallback(async () => {
    if (disabled || isScanning) return;

    setIsScanning(true);
    setScanProgress(0);

    // Simulate scanning progress
    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsScanning(false);
          setTimeout(onScanComplete, 500);
          return 100;
        }
        return prev + Math.random() * 15 + 5;
      });
    }, 200);
  }, [disabled, isScanning, onScanComplete]);

  return (
    <Card>
      <CardHeader>
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center">
          <Sparkles className="h-8 w-8 text-accent" />
        </div>
        <CardTitle className="text-center text-xl">Body Scan</CardTitle>
        <p className="text-muted-foreground text-center">
          Create accurate body measurements
        </p>
      </CardHeader>
      <CardContent>
        <div className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-8 text-center">
          <div className="w-24 h-32 mx-auto mb-4 bg-muted rounded-lg flex items-center justify-center">
            {isScanning ? (
              <Scan className="h-8 w-8 text-muted-foreground animate-pulse" />
            ) : scanProgress === 100 ? (
              <CheckCircle className="h-8 w-8 text-green-600" />
            ) : (
              <User className="h-8 w-8 text-muted-foreground" />
            )}
          </div>

          {isScanning && (
            <div className="mb-4">
              <Progress value={scanProgress} className="mb-2" />
              <p className="text-xs text-muted-foreground">
                Scanning... {Math.round(scanProgress)}%
              </p>
            </div>
          )}

          <p className="text-sm text-muted-foreground mb-4">
            {isScanning
              ? "Analyzing body measurements..."
              : scanProgress === 100
                ? "Scan complete!"
                : "Generate precise body measurements for perfect fit"}
          </p>

          <Button
            variant="outline"
            onClick={startScan}
            disabled={disabled || isScanning || scanProgress === 100}
          >
            {isScanning ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : scanProgress === 100 ? (
              <CheckCircle className="h-4 w-4 mr-2" />
            ) : (
              <Scan className="h-4 w-4 mr-2" />
            )}
            {isScanning
              ? "Scanning..."
              : scanProgress === 100
                ? "Complete"
                : "Start Scan"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AnalysisResults({ analysis }: { analysis: VirtualTryOnAnalysis }) {
  return (
    <Card className="elegant-shadow">
      <CardHeader className="glass-effect">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Analysis Results
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Personalized fit analysis and recommendations
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Body Profile Section */}
        <div className="glass-effect rounded-lg p-4">
          <h4 className="font-semibold mb-4 flex items-center gap-2 text-primary">
            <User className="h-4 w-4" />
            Body Profile
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">
                  Body Type
                </span>
                <Badge variant="outline" className="border-primary/30 text-primary">
                  {analysis.bodyType || "Analyzing..."}
                </Badge>
              </div>
            </div>
            <div className="space-y-3">
              {Object.entries(analysis.measurements).map(([key, value]) => (
                <div key={key} className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground capitalize">
                    {key}
                  </span>
                  <span className="text-sm font-mono bg-primary/5 px-2 py-1 rounded text-primary">
                    {value || "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Fit Recommendations Section */}
        <div className="glass-effect rounded-lg p-4">
          <h4 className="font-semibold mb-4 flex items-center gap-2 text-accent">
            <CheckCircle className="h-4 w-4" />
            Fit Recommendations
          </h4>
          <div className="space-y-3">
            {analysis.fitRecommendations.slice(0, 5).map((rec, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-accent/5 rounded-lg border border-accent/20">
                <span className="text-accent font-bold mt-0.5 text-sm">{index + 1}.</span>
                <span className="text-sm leading-relaxed">{rec}</span>
              </div>
            ))}
            {analysis.fitRecommendations.length === 0 && (
              <div className="text-sm text-muted-foreground italic p-3 text-center">
                Analysis in progress...
              </div>
            )}
          </div>
        </div>

        {/* Style Adjustments Section */}
        {analysis.styleAdjustments.length > 0 && (
          <div className="glass-effect rounded-lg p-4">
            <h4 className="font-semibold mb-4 flex items-center gap-2 text-primary">
              <Sparkles className="h-4 w-4" />
              Style Tips
            </h4>
            <div className="space-y-3">
              {analysis.styleAdjustments.map((adjustment, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20"
                >
                  <span className="text-primary font-bold mt-0.5 text-sm">{index + 1}.</span>
                  <span className="text-sm leading-relaxed">{adjustment}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function VirtualTryOn() {
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scanComplete, setScanComplete] = useState(false);
  const [outfitItems] = useState([
    { name: "Classic Blazer", type: "outerwear" },
    { name: "Silk Blouse", type: "top" },
    { name: "Tailored Trousers", type: "bottom" },
  ]);

  const [fashionAnalysis, setFashionAnalysis] = useState<any | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const {
    analysis,
    loading,
    error,
    analyzePhoto,
    enhanceTryOn,
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



  const handlePhotoSelect = useCallback(
    async (file: File) => {
      setSelectedPhoto(file);

      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);

      // Analyze the photo
      await analyzePhoto(file);
    },
    [analyzePhoto],
  );

  const handleScanComplete = useCallback(async () => {
    setScanComplete(true);
    // Simulate body scan analysis
    const mockFile = new File([""], "body-scan.jpg", { type: "image/jpeg" });
    await analyzePhoto(mockFile);
  }, [analyzePhoto]);

  const handleTryOnDesign = useCallback(async () => {
    if (!analysis) return;
    await enhanceTryOn(outfitItems);
  }, [analysis, enhanceTryOn, outfitItems]);

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

  // New function for personality critique
  const handlePersonalityCritique = useCallback(async (persona: StylistPersona) => {
    if (!selectedPhoto) return;
    
    try {
      const critique = await getPersonalityCritique(selectedPhoto, persona);
      if (critique) {
        // In a real implementation, you would display the critique
        alert(`Critique from ${persona}: ${critique}`);
      }
    } catch (err) {
      console.error("Personality critique error:", err);
    }
  }, [selectedPhoto, getPersonalityCritique]);

  const handleReset = useCallback(() => {
    setSelectedPhoto(null);
    setPreviewUrl(null);
    setScanComplete(false);
    setShowCamera(false);
    setTryOnResult(null);
    setFashionAnalysis(null);
    setShowAnalysis(false);
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
            Virtual Try-On
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg leading-relaxed">
            See yourself in any outfit with intelligent fit analysis and realistic visualization.
            Upload a photo or use our body scanning technology for personalized results.
          </p>
        </div>

        <div className="max-w-6xl mx-auto space-y-8">
          {/* Upload Methods */}
          {!selectedPhoto && !scanComplete && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <PhotoUpload
                onPhotoSelect={handlePhotoSelect}
                disabled={loading}
              />
              <BodyScanSimulation
                onScanComplete={handleScanComplete}
                disabled={loading}
              />
            </div>
          )}

          {/* Photo Preview */}
          {selectedPhoto && previewUrl && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Selected Photo
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Selected for AI analysis and virtual try-on
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center gap-4">
                  <div className="relative max-w-md">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt="Selected for AI analysis and virtual try-on"
                      className="w-full h-auto rounded-lg shadow-lg"
                    />
                    {loading && (
                      <div className="absolute inset-0 bg-black/20 rounded-lg flex items-center justify-center">
                        <div className="text-center">
                          <RefreshCw className="h-8 w-8 text-white animate-spin mx-auto mb-2" />
                          <p className="text-white text-sm font-medium">Analyzing...</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={handleReset}
                      disabled={loading}
                    >
                      Choose Different Photo
                    </Button>
                    {analysis && (
                      <Button
                        variant="secondary"
                        onClick={() => setSelectedPhoto(null)}
                        disabled={loading}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Re-analyze
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Scan Complete Indicator */}
          {scanComplete && (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <div className="text-center">
                  <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">
                    Body Scan Complete
                  </h3>
                  <p className="text-muted-foreground">
                    Your measurements have been analyzed and are ready for
                    try-on
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={handleReset}
                    disabled={loading}
                  >
                    Start New Scan
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

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
            {analysis && !tryOnResult && !showPersonalitySelection && !showAnalysis && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <AnalysisResults analysis={analysis} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Personality Selection */}
          <AnimatePresence mode="wait">
            {showPersonalitySelection && (
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

          {/* Try-On Result */}
          <AnimatePresence mode="wait">
            {tryOnResult && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <TryOnResult 
                  result={tryOnResult} 
                  onBack={() => setTryOnResult(null)} 
                />
              </motion.div>
            )}
          </AnimatePresence>
          {(selectedPhoto || scanComplete) && (
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
              <CardContent className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Ready for Virtual Try-On</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  {analysis
                    ? "Visualize outfit combinations with your personalized fit analysis"
                    : "Upload a photo or complete body scan to get started"
                  }
                </p>
                
                {!showPersonalitySelection ? (
                  <div className="flex flex-col gap-3">
                    <Button
                      className="fashion-gradient text-white px-6 py-2"
                      onClick={handleTryOnDesign}
                      disabled={loading || !analysis}
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Shirt className="h-4 w-4 mr-2" />
                          Try On Outfits
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleGetCritique}
                      disabled={loading || !analysis}
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Get AI Critique
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleFashionAnalysis}
                      disabled={loading || !selectedPhoto}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Fashion Analysis
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h4 className="font-medium">Select a Stylist Persona</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <PersonalityCard 
                        persona="luxury" 
                        isSelected={selectedPersona === "luxury"} 
                        onSelect={handlePersonaSelect}
                        disabled={loading}
                      />
                      <PersonalityCard 
                        persona="streetwear" 
                        isSelected={selectedPersona === "streetwear"} 
                        onSelect={handlePersonaSelect}
                        disabled={loading}
                      />
                      <PersonalityCard 
                        persona="sustainable" 
                        isSelected={selectedPersona === "sustainable"} 
                        onSelect={handlePersonaSelect}
                        disabled={loading}
                      />
                      <PersonalityCard 
                        persona="edina" 
                        isSelected={selectedPersona === "edina"} 
                        onSelect={handlePersonaSelect}
                        disabled={loading}
                      />
                      <PersonalityCard 
                        persona="miranda" 
                        isSelected={selectedPersona === "miranda"} 
                        onSelect={handlePersonaSelect}
                        disabled={loading}
                      />
                      <PersonalityCard 
                        persona="shaft" 
                        isSelected={selectedPersona === "shaft"} 
                        onSelect={handlePersonaSelect}
                        disabled={loading}
                      />
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowPersonalitySelection(false)}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                  </div>
                )}

                {analysis && (
                  <div className="mt-4 flex items-center justify-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Body analyzed</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Measurements ready</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span>Ready</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Getting Started Message */}
          {!selectedPhoto && !scanComplete && !loading && (
            <Card className="border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-2xl font-semibold mb-3">Virtual Try-On Experience</h3>
                <p className="text-muted-foreground text-center max-w-lg mb-6 leading-relaxed">
                  Experience intelligent fashion visualization. Upload a photo or use our
                  body scanning technology to get personalized measurements and see yourself
                  in any outfit with realistic lighting and proportions.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl">
                  <div className="text-center p-4 rounded-lg bg-background/50">
                    <Camera className="h-6 w-6 text-primary mx-auto mb-2" />
                    <p className="text-sm font-medium">Photo Upload</p>
                    <p className="text-xs text-muted-foreground">Quick AI analysis</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-background/50">
                    <Scan className="h-6 w-6 text-accent mx-auto mb-2" />
                    <p className="text-sm font-medium">Body Scan</p>
                    <p className="text-xs text-muted-foreground">Precise measurements</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-background/50">
                    <Sparkles className="h-6 w-6 text-primary mx-auto mb-2" />
                    <p className="text-sm font-medium">AI Try-On</p>
                    <p className="text-xs text-muted-foreground">Virtual visualization</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
};

const FashionAnalysis = ({ analysis, onBack }: { analysis: any; onBack: () => void }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Eye className="h-5 w-5" />
        Fashion Analysis Results
      </CardTitle>
      <p className="text-sm text-muted-foreground">
        Detailed analysis of your outfit
      </p>
    </CardHeader>
    <CardContent>
      <div className="space-y-6">
        {/* Rating */}
        {analysis.rating && (
          <div className="glass-effect rounded-lg p-4">
            <h4 className="font-semibold mb-2 flex items-center gap-2 text-primary">
              <Star className="h-4 w-4" />
              Overall Rating
            </h4>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{analysis.rating}/10</span>
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star 
                    key={i} 
                    className={`h-5 w-5 ${i < Math.floor(analysis.rating / 2) ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`} 
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Strengths */}
        {analysis.strengths && analysis.strengths.length > 0 && (
          <div className="glass-effect rounded-lg p-4">
            <h4 className="font-semibold mb-3 flex items-center gap-2 text-green-600">
              <CheckCircle className="h-4 w-4" />
              Strengths
            </h4>
            <ul className="space-y-2">
              {analysis.strengths.map((strength: string, index: number) => (
                <li key={index} className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{strength}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Areas for Improvement */}
        {analysis.improvements && analysis.improvements.length > 0 && (
          <div className="glass-effect rounded-lg p-4">
            <h4 className="font-semibold mb-3 flex items-center gap-2 text-orange-600">
              <Sparkles className="h-4 w-4" />
              Areas for Improvement
            </h4>
            <ul className="space-y-2">
              {analysis.improvements.map((improvement: string, index: number) => (
                <li key={index} className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{improvement}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Full Analysis */}
        {analysis.fullAnalysis && (
          <div className="glass-effect rounded-lg p-4">
            <h4 className="font-semibold mb-3 flex items-center gap-2 text-primary">
              <MessageCircle className="h-4 w-4" />
              Detailed Analysis
            </h4>
            <div className="text-sm whitespace-pre-wrap">
              {analysis.fullAnalysis}
            </div>
          </div>
        )}

        <div className="flex justify-center">
          <Button variant="outline" onClick={onBack}>
            Back to Try-On
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
);
