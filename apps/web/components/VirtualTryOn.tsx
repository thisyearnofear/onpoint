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
} from "lucide-react";
import { useVirtualTryOn } from "@repo/ai-client";
import type { VirtualTryOnAnalysis } from "@repo/ai-client";

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Analysis Results
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold mb-3">Body Profile</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  Body Type:
                </span>
                <Badge variant="outline">{analysis.bodyType}</Badge>
              </div>
              {Object.entries(analysis.measurements).map(([key, value]) => (
                <div key={key} className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground capitalize">
                    {key}:
                  </span>
                  <span className="text-sm">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-3">Fit Recommendations</h4>
            <div className="space-y-2">
              {analysis.fitRecommendations.slice(0, 5).map((rec, index) => (
                <div key={index} className="text-sm p-2 bg-muted/50 rounded">
                  {rec}
                </div>
              ))}
            </div>
          </div>
        </div>

        {analysis.styleAdjustments.length > 0 && (
          <div className="mt-6">
            <h4 className="font-semibold mb-3">Style Adjustments</h4>
            <div className="grid grid-cols-1 gap-2">
              {analysis.styleAdjustments.map((adjustment, index) => (
                <div
                  key={index}
                  className="text-sm p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border-l-4 border-blue-500"
                >
                  {adjustment}
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

  const {
    analysis,
    loading,
    error,
    analyzePhoto,
    enhanceTryOn,
    clearAnalysis,
    clearError,
  } = useVirtualTryOn();



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

  const handleReset = useCallback(() => {
    setSelectedPhoto(null);
    setPreviewUrl(null);
    setScanComplete(false);
    clearAnalysis();
    clearError();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
  }, [clearAnalysis, clearError, previewUrl]);

  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Virtual Try-On
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            See yourself wearing your creations. Upload a photo or use body
            scanning technology to visualize outfits with realistic lighting and
            proportions.
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
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center gap-4">
                  <div className="relative max-w-md">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt="Selected for try-on"
                      className="w-full h-auto rounded-lg shadow-lg"
                    />
                    {loading && (
                      <div className="absolute inset-0 bg-black/20 rounded-lg flex items-center justify-center">
                        <RefreshCw className="h-8 w-8 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    disabled={loading}
                  >
                    Choose Different Photo
                  </Button>
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
          {analysis && <AnalysisResults analysis={analysis} />}

          {/* Try-On Action */}
          {(selectedPhoto || scanComplete) && (
            <div className="text-center">
              <Button
                className="fashion-gradient text-white px-8 py-3 text-lg"
                onClick={handleTryOnDesign}
                disabled={loading || !analysis}
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 mr-2" />
                    Try On Selected Design
                  </>
                )}
              </Button>

              {analysis && (
                <p className="text-muted-foreground text-sm mt-2">
                  Ready to visualize outfit combinations based on your
                  measurements
                </p>
              )}
            </div>
          )}

          {/* Getting Started Message */}
          {!selectedPhoto && !scanComplete && !loading && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Camera className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">Get Started</h3>
                <p className="text-muted-foreground text-center max-w-md">
                  Upload a photo or use our body scanning technology to begin
                  your virtual try-on experience. Our AI will analyze your
                  measurements for the perfect fit.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
}
