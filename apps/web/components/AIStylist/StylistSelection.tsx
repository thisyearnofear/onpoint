import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import type { StylistPersona } from "@repo/ai-client";
import { PersonaCard } from './PersonaCard';

interface StylistSelectionProps {
  selectedPersona: StylistPersona;
  handlePersonaChange: (persona: StylistPersona) => void;
  loading: boolean;
}

export function StylistSelection({ selectedPersona, handlePersonaChange, loading }: StylistSelectionProps) {
  return (
    <Card className="elegant-shadow">
      <CardHeader className="glass-effect pb-4 pt-4">
        <CardTitle className="text-center text-lg">Choose Your Stylist</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Top Row - 3 Stylists */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <PersonaCard
            persona="luxury"
            isSelected={selectedPersona === "luxury"}
            onSelect={handlePersonaChange}
            disabled={loading}
          />
          <PersonaCard
            persona="streetwear"
            isSelected={selectedPersona === "streetwear"}
            onSelect={handlePersonaChange}
            disabled={loading}
          />
          <PersonaCard
            persona="sustainable"
            isSelected={selectedPersona === "sustainable"}
            onSelect={handlePersonaChange}
            disabled={loading}
          />
        </div>
        
        {/* Bottom Row - 3 Stylists */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <PersonaCard
            persona="edina"
            isSelected={selectedPersona === "edina"}
            onSelect={handlePersonaChange}
            disabled={loading}
          />
          <PersonaCard
            persona="miranda"
            isSelected={selectedPersona === "miranda"}
            onSelect={handlePersonaChange}
            disabled={loading}
          />
          <PersonaCard
            persona="shaft"
            isSelected={selectedPersona === "shaft"}
            onSelect={handlePersonaChange}
            disabled={loading}
          />
        </div>
      </CardContent>
    </Card>
  );
}