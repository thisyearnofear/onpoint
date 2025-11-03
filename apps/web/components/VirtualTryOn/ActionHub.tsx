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
  onCritiqueModeSelection,
  onFashionAnalysis,
}: ActionHubProps) {
  if (!hasInput) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Experience Hub
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Choose the next step for your personalized style session.
        </p>
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
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Building your fit profile...</span>
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
                  <p className="text-sm font-semibold">Virtual Try-On</p>
                  <p className="text-sm text-muted-foreground">Render realistic outfit swaps using your fit data.</p>
                </div>
              </div>
              <Button
                className="fashion-gradient text-white px-6 py-2 w-full md:w-auto"
                onClick={onTryOnDesign}
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
                    Launch Try-On
                  </>
                )}
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
                  <p className="text-sm font-semibold">AI Critique</p>
                  <p className="text-sm text-muted-foreground">Pick a stylist persona for feedback in the tone you prefer.</p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={onCritiqueModeSelection}
                disabled={loading || !analysis}
                className="w-full md:w-auto"
              >
                Choose Persona
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
                  <p className="text-sm font-semibold">Look Breakdown</p>
                  <p className="text-sm text-muted-foreground">Get trend insights and styling tips from your submitted photo.</p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={onFashionAnalysis}
                disabled={loading || !selectedPhoto}
                className="w-full md:w-auto"
              >
                Analyze Photo
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}