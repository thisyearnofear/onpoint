"use client";

import React, { useState } from "react";
import { Button } from "@repo/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Sparkles, Share, CheckCircle, ShoppingBag } from "lucide-react";
import { useMiniApp } from "@neynar/react";
import { SocialUtils } from "../../lib/utils/social";

interface TryOnResultProps {
  result: {
    id: string;
    image: string;
    description?: string;
    stylingTips?: string[];
    timestamp?: number;
  } | string; // Keep backward compatibility
  onBack: () => void;
  loading?: boolean;
}

// Utility function to parse simple markdown bold text
function parseMarkdownBold(text: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const boldText = part.slice(2, -2);
      return <strong key={index} className="font-semibold text-primary">{boldText}</strong>;
    }
    return part;
  });
}

export function TryOnResult({ result, onBack, loading = false }: TryOnResultProps) {
  const { context } = useMiniApp();
  const [copied, setCopied] = useState(false);

  // Handle both string and object formats
  const resultData = typeof result === 'string' ? { image: result } : result;
  const { image, description, stylingTips } = resultData;

  const handleShare = async () => {
    const shareText = `Just tried on this amazing look with BeOnPoint! 🔥 #BeOnPoint #Fashion #AI`;

    const success = await SocialUtils.shareContent(
      { text: shareText },
      context
    );

    if (success && !SocialUtils.isInFarcasterApp(context)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader className="text-center">
      <CardTitle className="flex items-center justify-center gap-2">
      <Sparkles className="h-5 w-5" />
      Virtual Try-On Result
      </CardTitle>
      <p className="text-sm text-muted-foreground text-center">
      Your personalized virtual try-on visualization
      </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
        <div className="relative aspect-[3/4] max-h-96 rounded-lg overflow-hidden bg-muted mx-auto">
        {loading ? (
        <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <Sparkles className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-muted-foreground text-center">Generating your personalized outfit...</p>
        <p className="text-xs text-muted-foreground mt-1 text-center">This may take a few moments</p>
        </div>
        </div>
        ) : image ? (
        <img
        src={image.startsWith('data:') ? image : `data:image/webp;base64,${image}`}
        alt="Virtual try-on result"
        className="w-full h-full object-cover mx-auto"
        />
        ) : (
        <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
        <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
        <p className="text-muted-foreground">Processing your try-on...</p>
        </div>
        </div>
        )}
        </div>

          {description && (
          <div className="text-center">
          <p className="text-sm font-medium text-center">Generated Outfit</p>
          <p className="text-sm text-muted-foreground text-center">{description}</p>
          </div>
          )}

          {stylingTips && stylingTips.length > 0 && (
          <div className="space-y-2 text-center">
          <p className="text-sm font-medium text-center">Styling Tips:</p>
          <ul className="text-sm text-muted-foreground space-y-1 inline-block text-left">
          {stylingTips.map((tip, index) => (
          <li key={index} className="flex items-start gap-2">
          <span className="text-primary mt-1">•</span>
          <span>{parseMarkdownBold(tip)}</span>
          </li>
          ))}
          </ul>
          </div>
          )}

          {/* Enhanced action buttons with sharing */}
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={onBack}>
              Try Another
            </Button>
            <Button onClick={handleShare}>
              {copied ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Share className="h-4 w-4 mr-2" />
                  {context?.client ? 'Share to Farcaster' : 'Share'}
                </>
              )}
            </Button>
          </div>

          <Button variant="outline" className="w-full">
            <ShoppingBag className="h-4 w-4 mr-2" />
            Shop Similar Items
          </Button>

              {/* AI Model Transparency Label */}
              <div className="text-xs text-gray-500 text-center mt-3 flex items-center justify-center gap-1">
                <span>🤖</span>
                <span>Powered by Venice AI (Stable Diffusion)</span>
              </div>
        </div>
      </CardContent>
    </Card>
  );
}