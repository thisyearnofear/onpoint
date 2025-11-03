"use client";

import React from "react";
import { Button } from "@repo/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Star, CheckCircle, Sparkles, MessageCircle, Eye } from "lucide-react";

interface FashionAnalysisProps {
  analysis: any;
  onBack: () => void;
}

export function FashionAnalysis({ analysis, onBack }: FashionAnalysisProps) {
  return (
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
}