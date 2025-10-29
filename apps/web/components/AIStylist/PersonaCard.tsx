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
  const [showPreview, setShowPreview] = React.useState(false);

  const personaConfig = {
    luxury: {
      title: "Luxury Expert",
      description: "Sophisticated styling for high-end fashion",
      icon: Crown,
      color: "text-amber-600",
      bgColor: "bg-amber-600/10",
      ringColor: "ring-amber-600",
      buttonBg: "bg-amber-600 hover:bg-amber-600/90",
      greeting: "Hello! I'm your luxury fashion expert. I specialize in sophisticated pieces, investment items, and timeless elegance.",
      expertise: ["High-end brands", "Investment pieces", "Formal occasions", "Timeless style"],
    },
    streetwear: {
      title: "Streetwear Guru",
      description: "Urban and contemporary fashion guidance",
      icon: Zap,
      color: "text-blue-600",
      bgColor: "bg-blue-600/10",
      ringColor: "ring-blue-600",
      buttonBg: "bg-blue-600 hover:bg-blue-600/90",
      greeting: "Hey! I'm your streetwear guru. Ready to dive into the latest drops, urban fashion, and fresh street style?",
      expertise: ["Latest drops", "Urban fashion", "Sneaker culture", "Street style"],
    },
    sustainable: {
      title: "Sustainable Consultant",
      description: "Eco-friendly and ethical fashion advice",
      icon: Leaf,
      color: "text-emerald-600",
      bgColor: "bg-emerald-600/10",
      ringColor: "ring-emerald-600",
      buttonBg: "bg-emerald-600 hover:bg-emerald-600/90",
      greeting: "Hi there! I'm your sustainable fashion consultant. Let's find beautiful, ethical pieces that align with your values.",
      expertise: ["Eco-friendly brands", "Ethical fashion", "Sustainable materials", "Conscious wardrobe"],
    },
    edina: {
      title: "Edina Monsoon",
      description: "Absolutely Fabulous fashion victim, darling!",
      icon: Sparkles,
      color: "text-pink-600",
      bgColor: "bg-pink-600/10",
      ringColor: "ring-pink-600",
      buttonBg: "bg-pink-600 hover:bg-pink-600/90",
      greeting: "Darling! Sweetie! It's Edina, and I am absolutely OBSESSED with making you look fabulous!",
      expertise: ["Avant-garde fashion", "Bold statements", "Designer pieces", "Dramatic flair"],
    },
    miranda: {
      title: "Miranda Priestly",
      description: "Runway editor with impossibly high standards",
      icon: Star,
      color: "text-purple-600",
      bgColor: "bg-purple-600/10",
      ringColor: "ring-purple-600",
      buttonBg: "bg-purple-600 hover:bg-purple-600/90",
      greeting: "I am Miranda Priestly. You have come to me seeking fashion guidance, and I will provide it—but only if you're prepared to meet the highest standards.",
      expertise: ["Runway trends", "High fashion", "Editorial style", "Perfection"],
    },
    shaft: {
      title: "John Shaft Style",
      description: "Cool 1970s sophistication with an edge",
      icon: ShoppingBag,
      color: "text-orange-600",
      bgColor: "bg-orange-600/10",
      ringColor: "ring-orange-600",
      buttonBg: "bg-orange-600 hover:bg-orange-600/90",
      greeting: "Right on. You've come to the right cat for some serious style advice. I know how to put together a look that commands respect.",
      expertise: ["Classic menswear", "Sophisticated edge", "Timeless cool", "Confident style"],
    },
  };

  const config = personaConfig[persona];
  const Icon = config.icon;

  return (
    <div className="relative">
      <Card
        className={`cursor-pointer transition-all duration-200 elegant-shadow hover:scale-[1.02] ${
          isSelected ? `ring-2 ${config.ringColor} shadow-xl bg-primary/5` : "hover:shadow-lg"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        onClick={() => !disabled && onSelect(persona)}
        onMouseEnter={() => setShowPreview(true)}
        onMouseLeave={() => setShowPreview(false)}
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

      {/* Hover Preview */}
      {showPreview && !disabled && (
        <div className="absolute top-full left-0 right-0 z-50 mt-2 p-4 bg-card border border-border rounded-lg shadow-xl animate-in fade-in-0 zoom-in-95 duration-200">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Icon className={`h-4 w-4 ${config.color}`} />
              <span className="font-medium text-sm">{config.title}</span>
            </div>
            <p className="text-xs text-muted-foreground italic leading-relaxed">
              &ldquo;{config.greeting}&rdquo;
            </p>
            <div>
              <p className="text-xs font-medium mb-1">Specializes in:</p>
              <div className="flex flex-wrap gap-1">
                {config.expertise.map((skill, idx) => (
                  <span 
                    key={idx}
                    className={`text-xs px-2 py-1 rounded-full ${config.bgColor} ${config.color}`}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
