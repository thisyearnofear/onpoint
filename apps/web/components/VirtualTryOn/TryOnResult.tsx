"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@repo/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Sparkles, Share, CheckCircle, ShoppingBag, ArrowRight, Palette, RefreshCw, Shirt } from "lucide-react";
import { useMiniApp } from "@neynar/react";
import { SocialUtils } from "../../lib/utils/social";

interface StructuredTipAction {
  type: string;
  label: string;
  payload: string;
}

interface StructuredTip {
  text: string;
  action?: StructuredTipAction;
}

interface TryOnResultProps {
  result: {
    id: string;
    image: string;
    description?: string;
    stylingTips?: string[];
    structuredTips?: StructuredTip[];
    timestamp?: number;
  } | string; // Keep backward compatibility
  onBack: () => void;
  loading?: boolean;
  originalPhotoUrl?: string;
  onVariantFromTip?: (args: { tip: string; payload?: string }) => void;
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

const PROGRESS_STAGES = [
  "Analyzing body proportions…",
  "Matching garment drape & fit…",
  "Rendering final look…",
  "Adding finishing touches…",
];

function StagedProgress() {
  const [stage, setStage] = useState(0);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    if (stage >= PROGRESS_STAGES.length - 1) return;
    const delay = 8000 + Math.random() * 4000; // 8-12s per stage
    const timer = setTimeout(() => setStage((s) => s + 1), delay);
    return () => clearTimeout(timer);
  }, [stage]);

  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="text-center px-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <Sparkles className="h-8 w-8 text-primary mx-auto mb-3" />
        <p className="text-sm font-medium text-primary mb-2 transition-all duration-500">
          {PROGRESS_STAGES[stage]}
        </p>
        <div className="flex items-center justify-center gap-1.5 mb-1">
          {PROGRESS_STAGES.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-500 ${
                i <= stage ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          This typically takes 30–60 seconds
        </p>
      </div>
    </div>
  );
}

export function TryOnResult({ result, onBack, loading = false, originalPhotoUrl, onVariantFromTip }: TryOnResultProps) {
  const { context } = useMiniApp();
  const [copied, setCopied] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const compareStartRef = useRef<number | null>(null);

  // Map action type to icon
  const actionIcon = (type: string) => {
    switch (type) {
      case 'color_change': return <Palette className="h-3.5 w-3.5" />;
      case 'garment_swap': return <Shirt className="h-3.5 w-3.5" />;
      default: return <RefreshCw className="h-3.5 w-3.5" />;
    }
  };

  // Handle both string and object formats
  const resultData = typeof result === 'string' ? { image: result } : result;
  const { image, description, stylingTips, structuredTips } = resultData as {
    image: string;
    description?: string;
    stylingTips?: string[];
    structuredTips?: StructuredTip[];
  };

  // Merge structured tips into a lookup for fast access when rendering plain tips
  const structuredByTip = React.useMemo(() => {
    const map = new Map<string, StructuredTip>();
    (structuredTips || []).forEach((tip) => map.set(tip.text, tip));
    return map;
  }, [structuredTips]);

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
        <StagedProgress />
        ) : image ? (
        <>
          <img
            src={(showOriginal && originalPhotoUrl) ? originalPhotoUrl : (image.startsWith('data:') ? image : `data:image/webp;base64,${image}`)}
            alt={showOriginal ? "Original photo" : "Virtual try-on result"}
            className="w-full h-full object-cover mx-auto transition-opacity duration-300"
          />
          {originalPhotoUrl && (
            <button
              className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs font-medium bg-black/60 text-white rounded-full px-3 py-1 backdrop-blur-sm hover:bg-black/80 transition-colors select-none"
              onMouseDown={() => { compareStartRef.current = Date.now(); setShowOriginal(true); }}
              onMouseUp={() => { setShowOriginal(false); compareStartRef.current = null; }}
              onMouseLeave={() => { setShowOriginal(false); compareStartRef.current = null; }}
              onTouchStart={() => { compareStartRef.current = Date.now(); setShowOriginal(true); }}
              onTouchEnd={() => { setShowOriginal(false); compareStartRef.current = null; }}
            >
              {showOriginal ? 'Original' : 'Hold to compare'}
            </button>
          )}
        </>
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
          <ul className="text-sm text-muted-foreground space-y-2.5 inline-block text-left">
          {stylingTips.map((tip, index) => {
            const structured = structuredByTip.get(tip);
            const hasAction = structured?.action && onVariantFromTip;
            return (
          <li key={index} className="flex items-start gap-2">
          <span className="text-primary mt-1 flex-shrink-0">•</span>
          <span className="flex-1">{parseMarkdownBold(tip)}</span>
          {hasAction && (
            <button
              onClick={() => onVariantFromTip!({ tip, payload: structured.action!.payload })}
              className="flex items-center gap-1 text-xs font-medium text-primary border border-primary/30 rounded-full px-2.5 py-0.5 hover:bg-primary/10 transition-colors whitespace-nowrap flex-shrink-0 mt-0.5"
            >
              {actionIcon(structured.action!.type)}
              {structured.action!.label}
            </button>
          )}
          {!hasAction && onVariantFromTip && (
            <button
              onClick={() => onVariantFromTip({ tip })}
              className="flex items-center gap-0.5 text-xs text-primary hover:underline whitespace-nowrap flex-shrink-0 mt-0.5"
            >
              Try variant <ArrowRight className="h-3 w-3" />
            </button>
          )}
          </li>
            );
          })}
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