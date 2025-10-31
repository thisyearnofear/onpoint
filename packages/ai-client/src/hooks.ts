import React from 'react';
import { useAIClient } from './context/AIContext';
import { DesignGeneration, VirtualTryOnAnalysis, StylistResponse, CritiqueResponse, StylistPersona, StyleSuggestion } from './providers/base-provider';
import AIClientManager from './ai-client';
import { ReplicateProvider } from './providers/replicate-provider';
import { fileToBase64 } from './utils/file-utils';

// Design Studio Implementation
export const useDesignStudio = () => {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [designs, setDesigns] = React.useState<DesignGeneration[]>([]);
  const aiClient = useAIClient();

  const generateDesign = React.useCallback(
    async (visionDescription: string): Promise<DesignGeneration | null> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/ai/design', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: visionDescription, type: 'design' })
        });

        if (!response.ok) {
          throw new Error(`Design API error: ${response.status}`);
        }

        const designData = await response.json();
        const design: DesignGeneration = {
          id: designData.id,
          description: designData.description,
          designPrompt: designData.designPrompt,
          variations: designData.variations,
          tags: designData.tags,
          timestamp: designData.timestamp
        };

        setDesigns((prev) => [design, ...prev]);
        return design;
      } catch (err) {
        setError(
          `Failed to generate design: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
        console.error("Design generation error:", err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const refineDesign = React.useCallback(
    async (designId: string, refinementPrompt: string): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        // Find the design to refine
        const designToRefine = designs.find(d => d.id === designId);
        if (!designToRefine) {
          throw new Error(`Design with ID ${designId} not found`);
        }

        // Create a refinement prompt
        const fullPrompt = `Original design: ${designToRefine.designPrompt}\nRefinement request: ${refinementPrompt}`;

        const response = await fetch('/api/ai/design', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: fullPrompt, type: 'refinement' })
        });

        if (!response.ok) {
          throw new Error(`Refinement API error: ${response.status}`);
        }

        const refinedData = await response.json();
        const refinedDesign: DesignGeneration = {
          id: refinedData.id,
          description: refinedData.description,
          designPrompt: `${designToRefine.designPrompt} (refined)`,
          variations: refinedData.variations,
          tags: refinedData.tags,
          timestamp: refinedData.timestamp
        };

        // Replace the original design with the refined one
        setDesigns(prev => prev.map(d => d.id === designId ? refinedDesign : d));
        return true;
      } catch (err) {
        setError(
          `Failed to refine design: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
        console.error("Design refinement error:", err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [designs]
  );

  return {
    designs,
    loading,
    error,
    generateDesign,
    refineDesign,
    clearError: () => setError(null),
  };
};

// Virtual Try-On Implementation
export const useVirtualTryOn = () => {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [analysis, setAnalysis] = React.useState<VirtualTryOnAnalysis | null>(
    null,
  );
  const aiClient = useAIClient();

  // Generate a cache key based on file properties
  const generateCacheKey = React.useCallback((file: File): string => {
    return `vto-analysis-${file.name}-${file.size}-${file.lastModified}`;
  }, []);

  // Get cached analysis if available
  const getCachedAnalysis = React.useCallback((file: File): VirtualTryOnAnalysis | null => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const cacheKey = generateCacheKey(file);
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          // Check if cache is still valid (less than 1 hour old)
          if (Date.now() - parsed.timestamp < 3600000) {
            return parsed.data;
          } else {
            // Remove expired cache
            localStorage.removeItem(cacheKey);
          }
        }
      }
    } catch (err) {
      console.warn("Failed to retrieve cached analysis:", err);
    }
    return null;
  }, [generateCacheKey]);

  // Cache analysis result
  const cacheAnalysis = React.useCallback((file: File, analysis: VirtualTryOnAnalysis) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const cacheKey = generateCacheKey(file);
        const cacheData = {
          data: analysis,
          timestamp: Date.now()
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      }
    } catch (err) {
      console.warn("Failed to cache analysis:", err);
    }
  }, [generateCacheKey]);

  const analyzePhoto = React.useCallback(
    async (imageFile: File): Promise<VirtualTryOnAnalysis | null> => {
      setLoading(true);
      setError(null);

      try {
        // Check cache first
        const cachedAnalysis = getCachedAnalysis(imageFile);
        if (cachedAnalysis) {
          setAnalysis(cachedAnalysis);
          setLoading(false);
          return cachedAnalysis;
        }

        // For now, we'll simulate photo analysis with a description
        // In a real implementation, you'd process the image file
        const description = imageFile.name.includes('body-scan')
          ? 'Body scan analysis for virtual try-on measurements'
          : 'Photo analysis for virtual try-on fitting';

        const response = await fetch('/api/ai/virtual-tryon', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'body-analysis',
            data: { description, fileName: imageFile.name }
          })
        });

        if (!response.ok) {
          throw new Error(`Virtual try-on API error: ${response.status}`);
        }

        const analysisData = await response.json();
        const analysis: VirtualTryOnAnalysis = {
          bodyType: analysisData.bodyType,
          measurements: analysisData.measurements,
          fitRecommendations: analysisData.fitRecommendations,
          styleAdjustments: analysisData.styleAdjustments
        };

        setAnalysis(analysis);
        cacheAnalysis(imageFile, analysis);
        return analysis;
      } catch (err) {
        setError(
          `Failed to analyze photo: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
        console.error("Photo analysis error:", err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [getCachedAnalysis, cacheAnalysis],
  );

  const enhanceTryOn = React.useCallback(
    async (outfitItems: Array<{ name: string, type?: string, description?: string }>): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/ai/virtual-tryon', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'enhancement',
            data: { items: outfitItems }
          })
        });

        if (!response.ok) {
          throw new Error(`Enhancement API error: ${response.status}`);
        }

        const enhancementData = await response.json();

        // Update analysis with enhancement data
        if (analysis) {
          setAnalysis(prev => prev ? {
            ...prev,
            fitRecommendations: [...prev.fitRecommendations, ...enhancementData.recommendations.map((r: any) => r.item)],
            styleAdjustments: [...prev.styleAdjustments, ...enhancementData.stylingTips]
          } : prev);
        }

        return true;
      } catch (err) {
        setError(
          `Failed to enhance try-on: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
        console.error("Try-on enhancement error:", err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [analysis]
  );

  return {
    analysis,
    loading,
    error,
    analyzePhoto,
    enhanceTryOn,
    clearAnalysis: () => setAnalysis(null),
    clearError: () => setError(null),
  };
};

// AI Stylist Agent Implementation
export const useAIStylist = (persona: StylistPersona = "luxury") => {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = React.useState<
    Array<{
      role: "user" | "assistant";
      content: string;
      timestamp: number;
    }>
  >([]);
  const aiClient = useAIClient();

  const chatWithStylist = React.useCallback(
    async (message: string): Promise<StylistResponse | null> => {
      setLoading(true);
      setError(null);

      try {
        const stylistResponse = await aiClient.chatWithStylist(message, persona);

        // Update conversation history
        setConversationHistory((prev) => [
          ...prev,
          { role: "user", content: message, timestamp: Date.now() },
          { role: "assistant", content: stylistResponse.message, timestamp: Date.now() + 1 },
        ]);

        return stylistResponse;
      } catch (err) {
        setError(
          `Failed to get styling advice: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
        console.error("Stylist chat error:", err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [aiClient, persona],
  );

  const generateStyleSuggestions = React.useCallback(
    async (preferences: { style: StylistPersona; occasion?: string; budget?: string }): Promise<StyleSuggestion[] | null> => {
      setLoading(true);
      setError(null);

      try {
        const suggestionPrompt = `Generate style suggestions for a ${preferences.style} style, for ${preferences.occasion || 'everyday'} occasion with ${preferences.budget || 'flexible'} budget. Provide suggestions in categories with items, descriptions, reasoning, and priority.`;
        // For now, we'll generate a mock response - in the future this could call the AI
        const mockSuggestions: StyleSuggestion[] = [
          {
            category: "tops",
            items: [
              {
                name: "Basic T-Shirt",
                description: "A versatile cotton t-shirt",
                reasoning: "Essential piece that goes with everything",
                priority: "high"
              },
              {
                name: "Blazer",
                description: "A tailored blazer",
                reasoning: "Elevates any outfit instantly",
                priority: "high"
              }
            ]
          },
          {
            category: "bottoms",
            items: [
              {
                name: "Dark Jeans",
                description: "Classic dark wash jeans",
                reasoning: "Goes with everything and fits any occasion",
                priority: "high"
              }
            ]
          }
        ];

        return mockSuggestions;
      } catch (err) {
        setError(
          `Failed to generate style suggestions: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
        console.error("Style suggestions error:", err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const clearConversation = React.useCallback(() => {
    setConversationHistory([]);
  }, []);

  return {
    conversationHistory,
    loading,
    error,
    chatWithStylist,
    generateStyleSuggestions,
    clearConversation,
    clearError: () => setError(null),
  };
};

// Color Palette Hook for Style Page
export const useAIColorPalette = () => {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [palette, setPalette] = React.useState<{
    colors: string[],
    colorDetails?: Array<{ name: string, hex: string, description: string }>,
    description: string,
    style?: string,
    season?: string,
    stylingSuggestions?: string[]
  } | null>(null);
  const aiClient = useAIClient();

  const generatePalette = React.useCallback(
    async (description: string, style: string = 'modern', season: string = 'all-season'): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/ai/color-palette', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description, style, season })
        });

        if (!response.ok) {
          throw new Error(`Color palette API error: ${response.status}`);
        }

        const paletteData = await response.json();
        setPalette({
          colors: paletteData.colors.map((c: any) => c.hex),
          colorDetails: paletteData.colors,
          description: paletteData.description,
          style: paletteData.style,
          season: paletteData.season,
          stylingSuggestions: paletteData.stylingSuggestions
        });
        return true;
      } catch (err) {
        setError(
          `Failed to generate color palette: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
        console.error("Color palette error:", err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    palette,
    loading,
    error,
    generatePalette,
    clearError: () => setError(null),
  };
};

// Style Suggestions Hook for Style Page
export const useAIStyleSuggestions = () => {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [suggestions, setSuggestions] = React.useState<StyleSuggestion[] | null>(null);
  const aiClient = useAIClient();

  const generateSuggestions = React.useCallback(
    async (preferences: { style: StylistPersona; occasion?: string; budget?: string }): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        // For now, we'll generate mock suggestions
        const mockSuggestions: StyleSuggestion[] = [
          {
            category: "accessories",
            items: [
              {
                name: "Statement Necklace",
                description: "Bold gold chain with geometric elements",
                reasoning: "Adds visual interest to simple outfits",
                priority: "high"
              }
            ]
          },
          {
            category: "outerwear",
            items: [
              {
                name: "Leather Jacket",
                description: "Classic black leather jacket for layering",
                reasoning: "Versatile piece that works with any outfit",
                priority: "high"
              }
            ]
          },
          {
            category: "bags",
            items: [
              {
                name: "Structured Handbag",
                description: "Minimalist structured bag in neutral tones",
                reasoning: "Professional yet stylish accessory",
                priority: "medium"
              }
            ]
          }
        ];
        setSuggestions(mockSuggestions);
        return true;
      } catch (err) {
        setError(
          `Failed to generate style suggestions: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
        console.error("Style suggestions error:", err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    suggestions,
    loading,
    error,
    generateSuggestions,
    clearError: () => setError(null),
  };
};

// Virtual Try-On Enhancement Hook for Style Page
export const useAIVirtualTryOnEnhancement = () => {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [enhancement, setEnhancement] = React.useState<{ enhancedOutfit: Array<{ name: string, description: string }>, stylingTips: string[] } | null>(null);
  const aiClient = useAIClient();

  const enhanceTryOn = React.useCallback(
    async (outfitItems: Array<{ name: string, description: string }>): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        // This would be a more complex implementation in the future
        // For now we'll just return true to indicate success
        console.log("Enhancing try-on with items:", outfitItems);
        setEnhancement({
          enhancedOutfit: outfitItems,
          stylingTips: [
            'Mix textures for visual interest - pair smooth fabrics with textured pieces',
            'Balance proportions - if wearing oversized top, pair with fitted bottoms',
            'Add a layering piece to create depth and versatility',
            'Consider the occasion when selecting accessories'
          ]
        });
        return true;
      } catch (err) {
        setError(
          `Failed to enhance try-on: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
        console.error("Try-on enhancement error:", err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    enhancement,
    loading,
    error,
    enhanceTryOn,
    clearError: () => setError(null),
  };
};

// Replicate Virtual Try-On Hook
export const useReplicateVirtualTryOn = () => {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<string | null>(null);
  
  // Generate a cache key based on input parameters
  const generateCacheKey = React.useCallback((garmImg: string, humanImg: string, garmentDes: string): string => {
    return `replicate-vto-${btoa(garmImg)}-${btoa(humanImg)}-${btoa(garmentDes)}`;
  }, []);

  // Get cached result if available
  const getCachedResult = React.useCallback((garmImg: string, humanImg: string, garmentDes: string): string | null => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const cacheKey = generateCacheKey(garmImg, humanImg, garmentDes);
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          // Check if cache is still valid (less than 24 hours old)
          if (Date.now() - parsed.timestamp < 86400000) {
            return parsed.data;
          } else {
            // Remove expired cache
            localStorage.removeItem(cacheKey);
          }
        }
      }
    } catch (err) {
      console.warn("Failed to retrieve cached result:", err);
    }
    return null;
  }, [generateCacheKey]);

  // Cache result
  const cacheResult = React.useCallback((garmImg: string, humanImg: string, garmentDes: string, result: string) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const cacheKey = generateCacheKey(garmImg, humanImg, garmentDes);
        const cacheData = {
          data: result,
          timestamp: Date.now()
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      }
    } catch (err) {
      console.warn("Failed to cache result:", err);
    }
  }, [generateCacheKey]);

  const processVirtualTryOn = React.useCallback(
    async (garmImg: string, humanImg: string, garmentDes: string): Promise<string | null> => {
      setLoading(true);
      setError(null);
      setResult(null);

      try {
        // Check cache first
        const cachedResult = getCachedResult(garmImg, humanImg, garmentDes);
        if (cachedResult) {
          setResult(cachedResult);
          setLoading(false);
          return cachedResult;
        }

        // Initialize Replicate provider
        const aiClientManager = new AIClientManager();
        const replicateProvider = aiClientManager.getReplicateProvider();
        
        if (!replicateProvider) {
          throw new Error('Replicate provider not configured. Please set REPLICATE_API_TOKEN environment variable.');
        }

        const outputUrl = await replicateProvider.processVirtualTryOn(garmImg, humanImg, garmentDes);
        setResult(outputUrl);
        cacheResult(garmImg, humanImg, garmentDes, outputUrl);
        return outputUrl;
      } catch (err) {
        setError(
          `Failed to process virtual try-on: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
        console.error("Virtual try-on error:", err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [getCachedResult, cacheResult]
  );

  // New hook for fashion image analysis
  const analyzeFashionImage = React.useCallback(
    async (imageFile: File): Promise<any | null> => {
      setLoading(true);
      setError(null);

      try {
        // Convert file to base64
        const base64 = await fileToBase64(imageFile);
        
        // Initialize Replicate provider
        const aiClientManager = new AIClientManager();
        const replicateProvider = aiClientManager.getReplicateProvider();
        
        if (!replicateProvider) {
          throw new Error('Replicate provider not configured. Please set REPLICATE_API_TOKEN environment variable.');
        }

        const analysis = await replicateProvider.analyzeFashionImage(base64);
        return analysis;
      } catch (err) {
        setError(
          `Failed to analyze fashion image: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
        console.error("Fashion analysis error:", err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // New hook for personality critiques
  const getPersonalityCritique = React.useCallback(
    async (imageFile: File, persona: string): Promise<string | null> => {
      setLoading(true);
      setError(null);

      try {
        // Convert file to base64
        const base64 = await fileToBase64(imageFile);
        
        // Initialize Replicate provider
        const aiClientManager = new AIClientManager();
        const replicateProvider = aiClientManager.getReplicateProvider();
        
        if (!replicateProvider) {
          throw new Error('Replicate provider not configured. Please set REPLICATE_API_TOKEN environment variable.');
        }

        const critique = await replicateProvider.getPersonalityCritique(base64, persona);
        return critique;
      } catch (err) {
        setError(
          `Failed to get ${persona} critique: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
        console.error("Personality critique error:", err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    result,
    loading,
    error,
    processVirtualTryOn,
    analyzeFashionImage,
    getPersonalityCritique,
    clearResult: () => setResult(null),
    clearError: () => setError(null),
  };
};



// Helper functions for collage page
export const isChromeAISupported = (): boolean => {
  try {
    return typeof window !== 'undefined' && 'ai' in window && window.ai !== undefined;
  } catch {
    return false;
  }
};

export const critiqueOutfit = async (
  input: File | Array<{ name: string, description: string }> | undefined | null,
  description?: string
): Promise<CritiqueResponse | null> => {
  const aiClient = new AIClientManager().getProvider();
  try {
    let imageFile: File | undefined;
    let combinedDescription = description || '';

    if (Array.isArray(input)) {
      // If input is an array of items (collageItems), extract descriptions
      combinedDescription = input.map(item =>
        `${item.name}: ${item.description}`
      ).join('\n\n') + (description ? `\n\n${description}` : '');
    } else if (input instanceof File) {
      // If input is a file, use it as the image
      imageFile = input;
    }

    const result = await aiClient.analyzeOutfit({
      description: combinedDescription,
      image: imageFile
    });
    return result;
  } catch (error) {
    console.error('Failed to critique outfit:', error);
    return null;
  }
};

export const useChromeAISupport = () => {
  const [supported, setSupported] = React.useState(false);

  React.useEffect(() => {
    setSupported(isChromeAISupported());
  }, []);

  return {
    supported,
    loading: false  // Since this resolves immediately
  };
};

export interface ClothingGenerationResponse {
  id: string;
  name: string;
  description: string;
  image?: string;
  variations: string[];
  styleNotes?: string;
  rating?: number;
  strengths?: string[];
  improvements?: string[];
  confidence?: number;
  colorPalette: string[];
  designElements?: string[];
  materials: string[];
}

export const generateClothingFromCollage = async (
  input: File | Array<{ name: string, description: string }>,
  description?: string
): Promise<ClothingGenerationResponse | null> => {
  const aiClient = new AIClientManager().getProvider();
  try {
    let processedDescription = description || '';

    if (Array.isArray(input)) {
      // If input is an array of items (collageItems), extract descriptions
      processedDescription = input.map(item =>
        `${item.name}: ${item.description}`
      ).join('\n\n') + (description ? ` ${description}` : '');
    } else if (input instanceof File) {
      // If input is a file, use the provided description or default
      processedDescription = description || "Generate clothing based on this image";
    }

    const result = await aiClient.generateDesign(`Based on these items: ${processedDescription} - Generate clothing that would fit the theme`);
    return {
      id: result.id,
      name: `Design from Collage-${result.id}`,
      description: result.description,
      variations: result.variations,
      styleNotes: "Style notes based on the generated design",
      colorPalette: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'],
      designElements: ['Design elements for the generated clothing'],
      rating: 8,
      strengths: ['Key strengths of the design'],
      improvements: ['Suggested improvements'],
      confidence: 0.9,
      materials: ['Premium fabric', 'Metal hardware', 'Synthetic materials']
    };
  } catch (error) {
    console.error('Failed to generate clothing from collage:', error);
    return null;
  }
};


// Outfit Analysis using Prompt API
export const useFashionCritique = () => {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const aiClient = useAIClient();

  const analyzeOutfit = React.useCallback(
    async (
      imageFile?: File,
      description?: string,
    ): Promise<CritiqueResponse | null> => {
      setLoading(true);
      setError(null);

      try {
        const critique = await aiClient.analyzeOutfit({ description, image: imageFile });
        return critique;
      } catch (err) {
        setError(
          `Failed to analyze outfit: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
        console.error("Outfit analysis error:", err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [aiClient],
  );

  return {
    loading,
    error,
    analyzeOutfit,
    clearError: () => setError(null),
  };
};
