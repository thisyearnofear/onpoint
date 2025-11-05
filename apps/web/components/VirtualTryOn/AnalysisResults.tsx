"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Button } from "@repo/ui/button";
import { Badge } from "@repo/ui/badge";
import { Sparkles, User, CheckCircle, Shirt, MessageCircle, Eye } from "lucide-react";
import type { VirtualTryOnAnalysis } from "@repo/ai-client";

interface AnalysisResultsProps {
  analysis: VirtualTryOnAnalysis;
  onAnalyzePerson?: () => void;
  onCritiqueModeSelection?: () => void;
  onFashionAnalysis?: () => void;
  isAnalyzingPerson?: boolean;
}

export function AnalysisResults({
  analysis,
  onAnalyzePerson,
  onCritiqueModeSelection,
  onFashionAnalysis,
  isAnalyzingPerson = false
}: AnalysisResultsProps) {
  const [expandedSection, setExpandedSection] = React.useState<string | null>(null);

  return (
    <Card className="elegant-shadow border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-4 w-4 text-primary" />
          Analysis Results
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Personalized fit analysis and recommendations
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Compact Body Profile */}
        <div className="border rounded-lg p-3 bg-muted/20">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-sm flex items-center gap-1.5 text-primary">
              <User className="h-3.5 w-3.5" />
              Body Profile
            </h4>
            <Badge variant="outline" className="text-xs border-primary/30 text-primary">
              {analysis.bodyType || "Analyzing..."}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {Object.entries(analysis.measurements).slice(0, 4).map(([key, value]) => (
              <div key={key} className="flex items-center gap-1">
                <span className="text-muted-foreground capitalize">{key}:</span>
                <span className="font-medium text-primary">{value || "—"}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Compact Fit Recommendations */}
        <div className="border rounded-lg p-3 bg-accent/5">
          <h4 className="font-medium text-sm mb-2 flex items-center gap-1.5 text-accent">
            <CheckCircle className="h-3.5 w-3.5" />
            Fit Recommendations
          </h4>
          <div className="space-y-1.5">
            {analysis.fitRecommendations.slice(0, 2).map((rec, index) => (
              <div key={index} className="text-xs leading-relaxed text-muted-foreground flex items-start gap-2">
                <span className="text-accent font-bold text-xs mt-0.5">•</span>
                <span>{rec}</span>
              </div>
            ))}
            {analysis.fitRecommendations.length > 2 && (
              <button
                onClick={() => setExpandedSection(expandedSection === 'fit' ? null : 'fit')}
                className="text-xs text-accent hover:underline mt-1"
              >
                {expandedSection === 'fit' ? 'Show less' : `+${analysis.fitRecommendations.length - 2} more`}
              </button>
            )}
            {expandedSection === 'fit' && analysis.fitRecommendations.slice(2).map((rec, index) => (
              <div key={index + 2} className="text-xs leading-relaxed text-muted-foreground flex items-start gap-2">
                <span className="text-accent font-bold text-xs mt-0.5">•</span>
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Compact Style Tips */}
        {analysis.styleAdjustments.length > 0 && (
          <div className="border rounded-lg p-3 bg-primary/5">
            <h4 className="font-medium text-sm mb-2 flex items-center gap-1.5 text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Style Tips
            </h4>
            <div className="space-y-1.5">
              {analysis.styleAdjustments.slice(0, 2).map((adjustment, index) => (
                <div key={index} className="text-xs leading-relaxed text-muted-foreground flex items-start gap-2">
                  <span className="text-primary font-bold text-xs mt-0.5">•</span>
                  <span>{adjustment}</span>
                </div>
              ))}
              {analysis.styleAdjustments.length > 2 && (
                <button
                  onClick={() => setExpandedSection(expandedSection === 'style' ? null : 'style')}
                  className="text-xs text-primary hover:underline mt-1"
                >
                  {expandedSection === 'style' ? 'Show less' : `+${analysis.styleAdjustments.length - 2} more`}
                </button>
              )}
              {expandedSection === 'style' && analysis.styleAdjustments.slice(2).map((adjustment, index) => (
                <div key={index + 2} className="text-xs leading-relaxed text-muted-foreground flex items-start gap-2">
                  <span className="text-primary font-bold text-xs mt-0.5">•</span>
                  <span>{adjustment}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 border-t border-border/50">
          <p className="text-xs text-muted-foreground mb-3 text-center">Choose your next experience</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {onAnalyzePerson && (
              <Button
                variant="outline"
                size="sm"
                onClick={onAnalyzePerson}
                disabled={isAnalyzingPerson}
                className="flex flex-col items-center gap-1 h-auto py-3 text-xs"
              >
                <Sparkles className="h-4 w-4" />
                <span>{isAnalyzingPerson ? 'Analyzing...' : 'Analyze Person'}</span>
              </Button>
            )}
            {onCritiqueModeSelection && (
              <Button
                variant="outline"
                size="sm"
                onClick={onCritiqueModeSelection}
                className="flex flex-col items-center gap-1 h-auto py-3 text-xs"
              >
                <MessageCircle className="h-4 w-4" />
                <span>AI Critique</span>
              </Button>
            )}
            {onFashionAnalysis && (
              <Button
                variant="outline"
                size="sm"
                onClick={onFashionAnalysis}
                className="flex flex-col items-center gap-1 h-auto py-3 text-xs"
              >
                <Eye className="h-4 w-4" />
                <span>Fashion Analysis</span>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
