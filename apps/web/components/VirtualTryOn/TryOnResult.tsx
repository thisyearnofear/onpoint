"use client";

import React, { useState } from "react";
import { Button } from "@repo/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Sparkles, Share, CheckCircle, ShoppingBag } from "lucide-react";
import { useMiniApp } from "@neynar/react";
import { SocialUtils } from "../../lib/utils/social";

interface TryOnResultProps {
  result: string;
  onBack: () => void;
}

export function TryOnResult({ result, onBack }: TryOnResultProps) {
  const { context } = useMiniApp();
  const [copied, setCopied] = useState(false);

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
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Virtual Try-On Result
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Your personalized virtual try-on visualization
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="relative aspect-square rounded-lg overflow-hidden bg-muted">
            {result ? (
              <img
                src={result}
                alt="Virtual try-on result"
                className="w-full h-full object-cover"
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
            <span>Powered by IDM-VTON AI model</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}