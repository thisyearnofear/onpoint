"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Badge } from "@repo/ui/badge";
import { Sparkles, User, CheckCircle } from "lucide-react";
import type { VirtualTryOnAnalysis } from "@repo/ai-client";

interface AnalysisResultsProps {
  analysis: VirtualTryOnAnalysis;
}

export function AnalysisResults({ analysis }: AnalysisResultsProps) {
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