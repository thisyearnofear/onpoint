"use client";

import React from "react";
import { Button } from "@repo/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Crown, Zap, Leaf, Sparkles, Star, MessageCircle, Flame, Heart, Scale } from "lucide-react";
import type { StylistPersona, CritiqueMode } from "@repo/ai-client";

interface CritiqueResultProps {
  persona: StylistPersona;
  critique: string;
  mode: CritiqueMode;
  onBack: () => void;
  onTryDifferentMode: () => void;
}

export function CritiqueResult({ persona, critique, mode, onBack, onTryDifferentMode }: CritiqueResultProps) {
  const getPersonaConfig = (persona: StylistPersona) => {
    const configs = {
      luxury: { icon: Crown, label: "Luxury Expert", color: "text-yellow-600", bg: "bg-yellow-50" },
      streetwear: { icon: Zap, label: "Streetwear Guru", color: "text-blue-600", bg: "bg-blue-50" },
      sustainable: { icon: Leaf, label: "Eco Stylist", color: "text-green-600", bg: "bg-green-50" },
      edina: { icon: Sparkles, label: "Edina Monsoon", color: "text-purple-600", bg: "bg-purple-50" },
      miranda: { icon: Star, label: "Miranda Priestly", color: "text-red-600", bg: "bg-red-50" },
      shaft: { icon: MessageCircle, label: "Shaft", color: "text-orange-600", bg: "bg-orange-50" }
    };
    return configs[persona] || configs.luxury;
  };

  const getModeConfig = (mode: CritiqueMode) => {
    const configs = {
      roast: { icon: Flame, label: "Roast Mode", color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
      flatter: { icon: Heart, label: "Flatter Mode", color: "text-pink-600", bg: "bg-pink-50", border: "border-pink-200" },
      real: { icon: Scale, label: "Real Mode", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" }
    };
    return configs[mode];
  };

  const personaConfig = getPersonaConfig(persona);
  const modeConfig = getModeConfig(mode);
  const PersonaIcon = personaConfig.icon;
  const ModeIcon = modeConfig.icon;

  return (
    <Card className={`max-w-2xl mx-auto ${modeConfig.border}`}>
      <CardHeader className={`${modeConfig.bg} border-b`}>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PersonaIcon className={`h-6 w-6 ${personaConfig.color}`} />
            <div>
              <div className="text-lg">{personaConfig.label}</div>
              <div className="text-sm text-muted-foreground font-normal">Fashion Critique</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ModeIcon className={`h-5 w-5 ${modeConfig.color}`} />
            <span className={`text-sm font-medium ${modeConfig.color}`}>{modeConfig.label}</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className={`prose prose-sm max-w-none ${mode === 'roast' ? 'text-red-900' :
            mode === 'flatter' ? 'text-pink-900' :
              'text-blue-900'
            }`}>
            <div className={`whitespace-pre-wrap text-sm leading-relaxed p-4 rounded-lg ${mode === 'roast' ? 'bg-red-50 border border-red-200' :
              mode === 'flatter' ? 'bg-pink-50 border border-pink-200' :
                'bg-blue-50 border border-blue-200'
              }`}>
              {critique}
            </div>
          </div>
          <div className="flex gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onBack} className="flex-1">
              Back to Try-On
            </Button>
            <Button
              className="flex-1"
              onClick={onTryDifferentMode}
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Try Different Mode
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}