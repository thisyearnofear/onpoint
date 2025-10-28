import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AIProvider } from '../providers/base-provider';
import AIClientManager from '../ai-client';

const AIContext = createContext<AIProvider | null>(null);

export function AIProviderContext({ children }: { children: ReactNode }) {
  const [provider, setProvider] = useState<AIProvider | null>(null);

  useEffect(() => {
    const initProvider = async () => {
      try {
        const aiClient = new AIClientManager();
        setProvider(aiClient.getProvider());
      } catch (error) {
        console.error('Failed to initialize AI provider:', error);
      }
    };
    initProvider();
  }, []);

  return (
    <AIContext.Provider value={provider}>
      {children}
    </AIContext.Provider>
  );
}

export const useAIClient = () => {
  const provider = useContext(AIContext);
  if (!provider) {
    // Return a mock provider for SSR/client-side rendering
    return {
      name: 'MockProvider',
      analyzeOutfit: async () => ({ rating: 0, strengths: [], improvements: [], styleNotes: '', confidence: 0 }),
      generateDesign: async () => ({ id: '', description: '', designPrompt: '', variations: [], tags: [], timestamp: 0 }),
      chatWithStylist: async () => ({ message: '', recommendations: [], stylingTips: [] }),
      analyzePhoto: async () => ({ bodyType: '', measurements: { shoulders: '', chest: '', waist: '', hips: '' }, fitRecommendations: [], styleAdjustments: [] })
    };
  }
  return provider;
};
