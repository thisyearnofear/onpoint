"use client";

import React from "react";
import { Card, CardContent } from "@repo/ui/card";
import { Camera, Scan, Sparkles } from "lucide-react";

interface WelcomeCardProps {
  hasInput: boolean;
  loading: boolean;
}

export function WelcomeCard({ hasInput, loading }: WelcomeCardProps) {
  if (hasInput || loading) return null;

  return (
    <Card className="border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
      <CardContent className="flex flex-col items-center justify-center py-16">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-10 w-10 text-primary" />
        </div>
        <h3 className="text-2xl font-semibold mb-3">Virtual Try-On Experience</h3>
        <p className="text-muted-foreground text-center max-w-lg mb-4 leading-relaxed">
        Experience intelligent fashion visualization. Upload a photo or use our
        body scanning technology to get personalized measurements and see yourself
        in any outfit with realistic lighting and proportions.
        </p>

        {/* Onboarding hint for new users */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mb-6 max-w-md mx-auto">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Quick Start</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Upload a photo → Get AI analysis → Try virtual outfits in 3 easy steps!
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl">
          <div className="text-center p-4 rounded-lg bg-background/50 hover:bg-background/70 transition-colors cursor-pointer">
            <Camera className="h-6 w-6 text-primary mx-auto mb-2" />
            <p className="text-sm font-medium">Photo Upload</p>
            <p className="text-xs text-muted-foreground">AI analyzes your body type & style</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-background/50 hover:bg-background/70 transition-colors cursor-pointer">
            <Scan className="h-6 w-6 text-accent mx-auto mb-2" />
            <p className="text-sm font-medium">Body Scan</p>
            <p className="text-xs text-muted-foreground">Extracts precise measurements</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-background/50 hover:bg-background/70 transition-colors cursor-pointer">
            <Sparkles className="h-6 w-6 text-primary mx-auto mb-2" />
            <p className="text-sm font-medium">Virtual Try-On</p>
            <p className="text-xs text-muted-foreground">See outfits on your body with AI</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}