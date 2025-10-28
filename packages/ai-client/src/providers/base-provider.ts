export interface AIProvider {
  name: string;
  analyzeOutfit(input: AnalysisInput): Promise<CritiqueResponse>;
  generateDesign(prompt: string): Promise<DesignGeneration>;
  chatWithStylist(message: string, persona: StylistPersona): Promise<StylistResponse>;
  analyzePhoto(file: File): Promise<VirtualTryOnAnalysis>;
}

export interface AnalysisInput {
  description?: string;
  image?: File;
  context?: any;
}

// Existing types from ai-client.ts
export interface CritiqueResponse {
  rating: number; // 1-10 scale
  strengths: string[];
  improvements: string[];
  styleNotes: string;
  confidence: number;
}

export interface StyleSuggestion {
  category: string;
  items: Array<{
    name: string;
    description: string;
    reasoning: string;
    priority: "high" | "medium" | "low";
  }>;
}

export interface DesignGeneration {
  id: string;
  description: string;
  designPrompt: string;
  variations: string[];
  tags: string[];
  timestamp: number;
}

export interface VirtualTryOnAnalysis {
  bodyType: string;
  measurements: {
    shoulders: string;
    chest: string;
    waist: string;
    hips: string;
  };
  fitRecommendations: string[];
  styleAdjustments: string[];
}

export interface StylistResponse {
  message: string;
  recommendations: Array<{
    item: string;
    reason: string;
    priority: number;
  }>;
  stylingTips: string[];
}

export type StylistPersona = "luxury" | "streetwear" | "sustainable";
