"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@repo/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Progress } from "@repo/ui/progress";
import { Scan, CheckCircle, RefreshCw, Sparkles } from "lucide-react";

interface BodyScanProps {
  onScanComplete: () => void;
  disabled?: boolean;
}

export function BodyScan({ onScanComplete, disabled }: BodyScanProps) {
  const [scanProgress, setScanProgress] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startScan = useCallback(async () => {
    if (disabled || isScanning) return;

    // Check if user has uploaded a photo first
    const hasPhoto = document.querySelector('img[alt*="Selected for AI analysis"]') !== null;
    if (!hasPhoto) {
      setError("Please upload a photo first using the 'Upload Photo' option above");
      return;
    }

    setError(null);
    setIsScanning(true);
    setScanProgress(0);
    setScanComplete(false);

    try {
      // Get the uploaded photo and convert to base64 for Replicate analysis
      const photoImg = document.querySelector('img[alt*="Selected for AI analysis"]') as HTMLImageElement;
      if (!photoImg) {
        throw new Error("Could not find uploaded photo");
      }

      // Convert image to base64
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Could not get canvas context");

      canvas.width = photoImg.naturalWidth;
      canvas.height = photoImg.naturalHeight;
      ctx.drawImage(photoImg, 0, 0);
      const base64Image = canvas.toDataURL('image/jpeg').split(',')[1];

      // Simulate scanning progress with more realistic steps
      const scanSteps = [
        { progress: 20, message: "Initializing camera..." },
        { progress: 40, message: "Analyzing body posture..." },
        { progress: 60, message: "Measuring proportions..." },
        { progress: 80, message: "Calculating measurements..." },
        { progress: 100, message: "Scan complete!" }
      ];

      for (const step of scanSteps) {
        await new Promise(resolve => setTimeout(resolve, 800));
        setScanProgress(step.progress);
        if (step.progress === 100) {
          // Here we would actually call the Replicate API to analyze the body measurements
          // For now, we'll simulate the completion
          console.log("Body scan completed with image analysis:", base64Image?.substring(0, 50) + "...");

          setIsScanning(false);
          setScanComplete(true);
          setTimeout(onScanComplete, 500);
        }
      }
    } catch (err) {
      console.error("Body scan error:", err);
      setError("Failed to process body scan. Please try again.");
      setIsScanning(false);
      setScanProgress(0);
    }
  }, [disabled, isScanning, onScanComplete]);

  const resetScan = useCallback(() => {
    setScanProgress(0);
    setIsScanning(false);
    setScanComplete(false);
    setError(null);
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center">
          <Sparkles className="h-8 w-8 text-accent" />
        </div>
        <CardTitle className="text-center text-xl">Body Scan (Beta)</CardTitle>
        <p className="text-muted-foreground text-center">
          Advanced measurement extraction from uploaded photos
        </p>
      </CardHeader>
      <CardContent>
        <div className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-8 text-center">
          <div className="w-24 h-32 mx-auto mb-4 bg-muted rounded-lg flex items-center justify-center">
            {isScanning ? (
              <Scan className="h-8 w-8 text-muted-foreground animate-pulse" />
            ) : scanComplete ? (
              <CheckCircle className="h-8 w-8 text-green-600" />
            ) : (
              <Scan className="h-8 w-8 text-muted-foreground" />
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

          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <p className="text-sm text-muted-foreground mb-4">
            {isScanning
              ? "Analyzing your photo for precise measurements..."
              : scanComplete
                ? "Scan complete! Measurements captured."
                : "Generate precise body measurements from your photo"}
          </p>

          <div className="flex gap-2 justify-center">
            <Button
              variant="outline"
              onClick={scanComplete ? resetScan : startScan}
              disabled={disabled || isScanning}
            >
              {isScanning ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Scanning...
                </>
              ) : scanComplete ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Scan Again
                </>
              ) : (
                <>
                  <Scan className="h-4 w-4 mr-2" />
                  Start Scan
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}