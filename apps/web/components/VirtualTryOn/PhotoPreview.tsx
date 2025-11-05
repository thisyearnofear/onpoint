"use client";

import React from "react";
import { Button } from "@repo/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Camera, RefreshCw, Sparkles } from "lucide-react";

interface PhotoPreviewProps {
  previewUrl: string | null;
  loading: boolean;
  analysis: any;
  onReset: () => void;
  onReanalyze: () => void;
  onAnalyze: () => void;
}

export function PhotoPreview({ previewUrl, loading, analysis, onReset, onReanalyze, onAnalyze }: PhotoPreviewProps) {
  if (!previewUrl) return null;

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
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
              onClick={onReset}
              disabled={loading}
            >
              Choose Different Photo
            </Button>
            {!analysis && (
              <Button
                onClick={onAnalyze}
                disabled={loading}
                className="fashion-gradient text-white"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Analyze Photo
              </Button>
            )}
            {analysis && (
              <Button
                variant="secondary"
                onClick={onReanalyze}
                disabled={loading}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Refresh Fit Analysis
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}