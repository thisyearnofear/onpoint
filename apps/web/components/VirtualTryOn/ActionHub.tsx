"use client";

import React from "react";
import { Button } from "@repo/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Sparkles, Shirt, MessageCircle, Eye, RefreshCw, CheckCircle } from "lucide-react";
import type { VirtualTryOnAnalysis } from "@repo/ai-client";

interface ActionHubProps {
  analysis: VirtualTryOnAnalysis | null;
  loading: boolean;
  hasInput: boolean;
  scanComplete: boolean;
  selectedPhoto: File | null;
  onTryOnDesign: () => void;
  onBodyScan: () => void;
  onCritiqueModeSelection: () => void;
  onFashionAnalysis: () => void;
}

export function ActionHub({
  analysis,
  loading,
  hasInput,
  scanComplete,
  selectedPhoto,
  onTryOnDesign,
  onBodyScan,
  onCritiqueModeSelection,
  onFashionAnalysis,
}: ActionHubProps) {
  if (!hasInput) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
     <CardHeader>
       <CardTitle className="flex items-center gap-2">
         <Sparkles className="h-5 w-5 text-primary" />
         Style Experience Hub
       </CardTitle>
       <p className="text-sm text-muted-foreground">
         Choose the next step for your personalized style session.
       </p>

        {/* Progress indicator - responsive design */}
        <div className="mt-3">
        {/* Mobile: vertical stacked */}
        <div className="md:hidden space-y-2">
        <div className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0"></div>
            <span className="text-primary font-medium">✓ Photo uploaded</span>
          </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-muted-foreground/30 flex-shrink-0"></div>
            <span>Choose your AI experience below</span>
          </div>
        </div>

        {/* Desktop: horizontal */}
        <div className="hidden md:flex items-center justify-center gap-2">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-primary"></div>
              <span className="text-xs text-primary font-medium">Photo Ready</span>
            </div>
            <div className="w-4 h-px bg-muted-foreground/30"></div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-muted-foreground/30"></div>
              <span className="text-xs text-muted-foreground">Choose Experience</span>
            </div>
            <div className="w-4 h-px bg-muted-foreground/30"></div>
        <div className="flex items-center gap-1">
        <div className="w-2 h-2 rounded-full bg-muted-foreground/30"></div>
        <span className="text-xs text-muted-foreground">See Results</span>
        </div>
        </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {analysis ? (
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
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
        ) : (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <span>Choose your next step below</span>
          </div>
        )}

        {scanComplete && !analysis && (
          <div className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-accent">
            Body scan measurements captured. Launch an experience once analysis finishes.
          </div>
        )}

        <div className="space-y-4">
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <Shirt className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Style Outfit Generator</p>
                  <p className="text-sm text-muted-foreground">AI creates personalized outfit combinations tailored to your body type and measurements.</p>
                </div>
              </div>
              <Button
                className="fashion-gradient text-white px-6 py-3 h-16 w-full md:w-auto"
                onClick={onTryOnDesign}
                disabled={loading || !analysis}
              >
                {loading ? (
                  <div className="flex flex-col items-center gap-1">
                    <RefreshCw className="h-5 w-5 animate-spin" />
                    <span className="text-xs font-medium">Processing...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <Shirt className="h-5 w-5" />
                    <span className="text-xs font-medium">Generate</span>
                  </div>
                )}
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-accent/30 bg-accent/5 p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-accent/10 p-2">
                  <Sparkles className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Body Scan</p>
                  <p className="text-sm text-muted-foreground">Advanced AI extracts precise body measurements for perfect virtual fitting.</p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={onBodyScan}
                disabled={loading || !selectedPhoto}
                className="h-16 w-full md:w-auto"
              >
                <div className="flex flex-col items-center gap-1">
                  <Sparkles className="h-5 w-5" />
                  <span className="text-xs font-medium">Scan</span>
                </div>
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-muted p-2">
                  <MessageCircle className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">AI Stylist Critique</p>
                  <p className="text-sm text-muted-foreground">Get personalized fashion feedback from expert personas with different styles and tones.</p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={onCritiqueModeSelection}
                disabled={loading || !analysis}
                className="h-16 w-full md:w-auto"
              >
                <div className="flex flex-col items-center gap-1">
                  <MessageCircle className="h-5 w-5" />
                  <span className="text-xs font-medium">Persona</span>
                </div>
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-muted p-2">
                  <Eye className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Fashion Analysis</p>
                  <p className="text-sm text-muted-foreground">Detailed style breakdown with trend insights, color analysis, and improvement tips.</p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={onFashionAnalysis}
                disabled={loading || !selectedPhoto}
                className="h-16 w-full md:w-auto"
              >
                <div className="flex flex-col items-center gap-1">
                  <Eye className="h-5 w-5" />
                  <span className="text-xs font-medium">Analyze</span>
                </div>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}