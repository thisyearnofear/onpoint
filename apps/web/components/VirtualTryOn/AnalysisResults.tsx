"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Button } from "@repo/ui/button";
import { Badge } from "@repo/ui/badge";
import { Sparkles, User, CheckCircle, MessageCircle, Wallet, Shirt } from "lucide-react";
import type { VirtualTryOnAnalysis } from "@repo/ai-client";

interface AnalysisResultsProps {
  analysis: VirtualTryOnAnalysis;
  onCritiqueModeSelection?: () => void;
  onShopRecommendations?: () => void;
}

export function AnalysisResults({
  analysis,
  onCritiqueModeSelection,
  onShopRecommendations,
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
        {/* Current Look (if available) */}
        {(analysis as any).currentLook && (analysis as any).currentLook.length > 0 && (
          <div className="border rounded-lg p-3 bg-blue-50/50 dark:bg-blue-950/20">
            <h4 className="font-medium text-sm mb-2 flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
              <Shirt className="h-3.5 w-3.5" />
              What You're Wearing
            </h4>
            <div className="space-y-1.5">
              {(analysis as any).currentLook.slice(0, 2).map((item: string, index: number) => (
                <div key={index} className="text-xs leading-relaxed text-muted-foreground">
                  {item}
                </div>
              ))}
            </div>
          </div>
        )}

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
        <div className="border rounded-lg p-3 bg-green-50/50 dark:bg-green-950/20">
          <h4 className="font-medium text-sm mb-2 flex items-center gap-1.5 text-green-600 dark:text-green-400">
            <CheckCircle className="h-3.5 w-3.5" />
            Fit & Sizing
          </h4>
          <p className="text-[10px] text-muted-foreground mb-2 italic">How clothes should fit your proportions</p>
          <div className="space-y-1.5">
            {((analysis as any).fitRecommendations || analysis.fitRecommendations).slice(0, 2).map((rec: string, index: number) => (
              <div key={index} className="text-xs leading-relaxed text-muted-foreground flex items-start gap-2">
                <span className="text-green-600 dark:text-green-400 font-bold text-xs mt-0.5">•</span>
                <span>{rec}</span>
              </div>
            ))}
            {((analysis as any).fitRecommendations || analysis.fitRecommendations).length > 2 && (
              <button
                onClick={() => setExpandedSection(expandedSection === 'fit' ? null : 'fit')}
                className="text-xs text-green-600 dark:text-green-400 hover:underline mt-1"
              >
                {expandedSection === 'fit' ? 'Show less' : `+${((analysis as any).fitRecommendations || analysis.fitRecommendations).length - 2} more`}
              </button>
            )}
            {expandedSection === 'fit' && ((analysis as any).fitRecommendations || analysis.fitRecommendations).slice(2).map((rec: string, index: number) => (
              <div key={index + 2} className="text-xs leading-relaxed text-muted-foreground flex items-start gap-2">
                <span className="text-green-600 dark:text-green-400 font-bold text-xs mt-0.5">•</span>
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Compact Style Recommendations */}
        {(((analysis as any).styleRecommendations && (analysis as any).styleRecommendations.length > 0) || 
          (analysis.styleAdjustments && analysis.styleAdjustments.length > 0)) && (
          <div className="border rounded-lg p-3 bg-purple-50/50 dark:bg-purple-950/20">
            <h4 className="font-medium text-sm mb-2 flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
              <Sparkles className="h-3.5 w-3.5" />
              Style & Colors
            </h4>
            <p className="text-[10px] text-muted-foreground mb-2 italic">What styles and colors suit you best</p>
            <div className="space-y-1.5">
              {((analysis as any).styleRecommendations || analysis.styleAdjustments).slice(0, 2).map((adjustment: string, index: number) => (
                <div key={index} className="text-xs leading-relaxed text-muted-foreground flex items-start gap-2">
                  <span className="text-purple-600 dark:text-purple-400 font-bold text-xs mt-0.5">•</span>
                  <span>{adjustment}</span>
                </div>
              ))}
              {((analysis as any).styleRecommendations || analysis.styleAdjustments).length > 2 && (
                <button
                  onClick={() => setExpandedSection(expandedSection === 'style' ? null : 'style')}
                  className="text-xs text-purple-600 dark:text-purple-400 hover:underline mt-1"
                >
                  {expandedSection === 'style' ? 'Show less' : `+${((analysis as any).styleRecommendations || analysis.styleAdjustments).length - 2} more`}
                </button>
              )}
              {expandedSection === 'style' && ((analysis as any).styleRecommendations || analysis.styleAdjustments).slice(2).map((adjustment: string, index: number) => (
                <div key={index + 2} className="text-xs leading-relaxed text-muted-foreground flex items-start gap-2">
                  <span className="text-purple-600 dark:text-purple-400 font-bold text-xs mt-0.5">•</span>
                  <span>{adjustment}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Personalization (if available) */}
        {(analysis as any).personalization && (analysis as any).personalization.length > 0 && (
          <div className="border rounded-lg p-3 bg-amber-50/50 dark:bg-amber-950/20">
            <h4 className="font-medium text-sm mb-2 flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <Sparkles className="h-3.5 w-3.5" />
              Just For You
            </h4>
            <p className="text-[10px] text-muted-foreground mb-2 italic">Based on your specific look</p>
            <div className="space-y-1.5">
              {(analysis as any).personalization.map((tip: string, index: number) => (
                <div key={index} className="text-xs leading-relaxed text-muted-foreground flex items-start gap-2">
                  <span className="text-amber-600 dark:text-amber-400 font-bold text-xs mt-0.5">✨</span>
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 border-t border-border/50">
          <p className="text-xs text-muted-foreground mb-3 text-center">What's next?</p>
          <div className="grid grid-cols-2 gap-2">
            {onCritiqueModeSelection && (
              <Button
                variant="outline"
                size="sm"
                onClick={onCritiqueModeSelection}
                className="flex flex-col items-center gap-1 h-auto py-3 text-xs"
              >
                <MessageCircle className="h-4 w-4" />
                <span>Get Critique</span>
              </Button>
            )}
            <Button
              variant="default"
              size="sm"
              onClick={onShopRecommendations || (() => {
                if (typeof window !== 'undefined') {
                  sessionStorage.setItem('stylistAnalysis', JSON.stringify({
                    bodyType: analysis.bodyType,
                    measurements: analysis.measurements,
                    styleRecommendations: (analysis as any).styleRecommendations || analysis.styleAdjustments,
                    personalization: (analysis as any).personalization,
                  }));
                  window.location.href = '/shop';
                }
              })}
              className="flex flex-col items-center gap-1 h-auto py-3 text-xs bg-gradient-to-r from-primary to-accent hover:opacity-90"
            >
              <Wallet className="h-4 w-4" />
              <span>Let Agent Shop</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
