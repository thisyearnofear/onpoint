"use client";

import { PERSONA_QUOTES } from "../../lib/utils/persona-critiques";
import { getPersonaConfig } from "../../lib/utils/persona-config";
import type { StylistPersona } from "@repo/ai-client";

export function PersonaChip({ persona }: { persona: StylistPersona }) {
  const config = getPersonaConfig(persona);
  const Icon = config.icon;
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full ${config.bg} border ${config.border} px-2.5 py-1 transition-all duration-500`}>
      <Icon className={`h-3 w-3 ${config.text}`} />
      <span className="text-[10px] font-bold text-foreground">
        {config.characterName.split(" ")[0]}:
      </span>
      <span className={`text-[10px] font-medium ${config.text}`}>
        &ldquo;{PERSONA_QUOTES[persona]}&rdquo;
      </span>
    </div>
  );
}
