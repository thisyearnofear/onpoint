import React from 'react';
import { Card } from "@repo/ui/card";
import { Button } from "@repo/ui/button";
import type { StylistPersona } from "@repo/ai-client";
import {
  Crown,
  Zap,
  Leaf,
  Sparkles,
  Star,
  ShoppingBag,
} from "lucide-react";

interface PersonaCardProps {
  persona: StylistPersona;
  isSelected: boolean;
  onSelect: (persona: StylistPersona) => void;
  disabled?: boolean;
}

export function PersonaCard({
  persona,
  isSelected,
  onSelect,
  disabled,
}: PersonaCardProps) {
  const personaConfig = {
    luxury: {
      title: "Luxury Expert",
      description: "Sophisticated styling for high-end fashion",
      icon: Crown,
      color: "text-amber-600",
      bgColor: "bg-amber-600/10",
      ringColor: "ring-amber-600",
      buttonBg: "bg-amber-600 hover:bg-amber-600/90",
    },
    streetwear: {
      title: "Streetwear Guru",
      description: "Urban and contemporary fashion guidance",
      icon: Zap,
      color: "text-blue-600",
      bgColor: "bg-blue-600/10",
      ringColor: "ring-blue-600",
      buttonBg: "bg-blue-600 hover:bg-blue-600/90",
    },
    sustainable: {
      title: "Sustainable Consultant",
      description: "Eco-friendly and ethical fashion advice",
      icon: Leaf,
      color: "text-emerald-600",
      bgColor: "bg-emerald-600/10",
      ringColor: "ring-emerald-600",
      buttonBg: "bg-emerald-600 hover:bg-emerald-600/90",
    },
    edina: {
      title: "Edina Monsoon",
      description: "Absolutely Fabulous fashion victim, darling!",
      icon: Sparkles,
      color: "text-pink-600",
      bgColor: "bg-pink-600/10",
      ringColor: "ring-pink-600",
      buttonBg: "bg-pink-600 hover:bg-pink-600/90",
    },
    miranda: {
      title: "Miranda Priestly",
      description: "Runway editor with impossibly high standards",
      icon: Star,
      color: "text-purple-600",
      bgColor: "bg-purple-600/10",
      ringColor: "ring-purple-600",
      buttonBg: "bg-purple-600 hover:bg-purple-600/90",
    },
    shaft: {
      title: "John Shaft Style",
      description: "Cool 1970s sophistication with an edge",
      icon: ShoppingBag,
      color: "text-orange-600",
      bgColor: "bg-orange-600/10",
      ringColor: "ring-orange-600",
      buttonBg: "bg-orange-600 hover:bg-orange-600/90",
    },
  };

  const config = personaConfig[persona];
  const Icon = config.icon;

  return (
    <Card
      className={`cursor-pointer transition-all duration-200 elegant-shadow hover:scale-[1.02] ${
        isSelected ? `ring-2 ${config.ringColor} shadow-xl bg-primary/5` : "hover:shadow-lg"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      onClick={() => !disabled && onSelect(persona)}
    >
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full ${config.bgColor} flex items-center justify-center flex-shrink-0`}
          >
            <Icon className={`h-5 w-5 ${config.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm truncate">{config.title}</h4>
            <p className="text-muted-foreground text-xs truncate">
              {config.description}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant={isSelected ? "default" : "outline"}
          className={`w-full mt-3 text-xs ${
            isSelected ? `${config.buttonBg} text-white` : `border-primary/30 text-primary hover:bg-primary/5`
          }`}
          disabled={disabled}
        >
          {isSelected ? "Selected" : "Select"}
        </Button>
      </div>
    </Card>
  );
}
