import { AIProvider, AnalysisInput, CritiqueResponse, DesignGeneration, StylistPersona, StylistResponse, VirtualTryOnAnalysis } from "./base-provider";

// Chrome AI API Types
declare global {
  interface Window {
    ai?: {
      languageModel?: {
        availability(): Promise<"readily" | "after-download" | "no">;
        create(options?: {
          temperature?: number;
          topK?: number;
          initialPrompts?: Array<{ 
            role: "system" | "user" | "assistant";
            content: string;
          }>;
          signal?: AbortSignal;
          monitor?: (monitor: any) => void;
        }): Promise<AILanguageModel>;
        params(): Promise<{ 
          defaultTopK: number;
          maxTopK: number;
          defaultTemperature: number;
          maxTemperature: number;
        }>;
      };
      writer?: {
        availability(): Promise<"readily" | "after-download" | "no">;
        create(options?: {
          tone?: "formal" | "neutral" | "casual";
          format?: "plain-text" | "markdown";
          length?: "short" | "medium" | "long";
        }): Promise<AIWriter>;
      };
      rewriter?: {
        availability(): Promise<"readily" | "after-download" | "no">;
        create(options?: {
          tone?: "as-is" | "more-formal" | "more-casual";
          format?: "as-is" | "plain-text" | "markdown";
          length?: "as-is" | "shorter" | "longer";
        }): Promise<AIRewriter>;
      };
      summarizer?: {
        availability(): Promise<"readily" | "after-download" | "no">;
        create(options?: {
          type?: "tl;dr" | "key-points" | "teaser" | "headline";
          format?: "plain-text" | "markdown";
          length?: "short" | "medium" | "long";
        }): Promise<AISummarizer>;
      };
    };
  }

  interface AILanguageModel {
    prompt(
      input: string,
      options?: {
        signal?: AbortSignal;
        responseConstraint?: any;
      },
    ): Promise<string>;
    promptStreaming(
      input: string,
      options?: {
        signal?: AbortSignal;
      },
    ): ReadableStream<string>;
    destroy(): void;
    clone(): Promise<AILanguageModel>;
  }

  interface AIWriter {
    write(
      input: string,
      options?: {
        context?: string;
        signal?: AbortSignal;
      },
    ): Promise<string>;
    writeStreaming(
      input: string,
      options?: {
        context?: string;
        signal?: AbortSignal;
      },
    ): ReadableStream<string>;
    destroy(): void;
  }

  interface AIRewriter {
    rewrite(
      input: string,
      options?: {
        context?: string;
        signal?: AbortSignal;
      },
    ): Promise<string>;
    rewriteStreaming(
      input: string,
      options?: {
        context?: string;
        signal?: AbortSignal;
      },
    ): ReadableStream<string>;
    destroy(): void;
  }

  interface AISummarizer {
    summarize(
      input: string,
      options?: {
        context?: string;
        signal?: AbortSignal;
      },
    ): Promise<string>;
    summarizeStreaming(
      input: string,
      options?: {
        context?: string;
        signal?: AbortSignal;
      },
    ): ReadableStream<string>;
    destroy(): void;
  }
}

export class ChromeAIProvider implements AIProvider {
  name = "Chrome AI";

  private checkChromeAI(): boolean {
    return typeof window !== "undefined" && "ai" in window && window.ai !== undefined;
  }

  async analyzeOutfit(input: AnalysisInput): Promise<CritiqueResponse> {
    if (!this.checkChromeAI()) {
      throw new Error("Chrome Built-in AI not available");
    }

    const availability = await window.ai!.languageModel!.availability();
    if (availability === "no") {
      throw new Error("Language model not available on this device");
    }

    const session = await window.ai!.languageModel!.create({
      temperature: 0.6,
      topK: 25,
      initialPrompts: [
        {
          role: "system",
          content: `You are a professional fashion critic with expertise in style, color theory,
                   fit, and fashion trends. Provide constructive, helpful feedback on outfits.
                   Always be encouraging while offering specific improvement suggestions.
                   Rate outfits on a 1-10 scale and explain your reasoning.`,
        },
      ],
    });

    const critiquePrompt = `Analyze this outfit ${input.description ? `described as: "${input.description}"` : "from the provided image"}.

Provide:
1. Overall rating (1-10) with brief explanation
2. 3-4 specific strengths of the outfit
3. 2-3 areas for improvement with actionable suggestions
4. Style notes about the overall aesthetic
5. Your confidence level in this analysis (1-10)

Be constructive and focus on actionable advice.`;

    const result = await session.prompt(critiquePrompt);
    session.destroy();

    // Parse the response into structured data
    const lines = result.split("\n").filter((line) => line.trim());

    const ratingMatch = result.match(
      /(\d+(?:\.\d+)?)\s*(?:\/10|out of 10)/i,
    );
    const rating = ratingMatch ? parseFloat(ratingMatch[1] || "7.5") : 7.5;

    const strengths = lines
      .filter(
        (line) =>
          line.includes("strength") ||
          line.includes("good") ||
          line.includes("great") ||
          line.includes("excellent"),
      )
      .slice(0, 4);

    const improvements = lines
      .filter(
        (line) =>
          line.includes("improve") ||
          line.includes("consider") ||
          line.includes("try") ||
          line.includes("could"),
      )
      .slice(0, 3);

    const styleNotes = lines
        .filter(
          (line) =>
            line.includes("style") ||
            line.includes("aesthetic") ||
            line.includes("vibe"),
        )
        .join(" ") ||
      "Clean, well-coordinated look with good attention to detail.";

    const confidenceMatch = result.match(/confidence.*?(\d+(?:\.\d+)?)/i);
    const confidence = confidenceMatch
      ? parseFloat(confidenceMatch[1] || "8") / 10
      : 0.8;

    return {
      rating,
      strengths,
      improvements,
      styleNotes,
      confidence,
    };
  }

  async generateDesign(prompt: string): Promise<DesignGeneration> {
    if (!this.checkChromeAI()) {
      throw new Error("Chrome Built-in AI not available");
    }

    const availability = await window.ai!.languageModel!.availability();
    if (availability === "no") {
      throw new Error("Language model not available on this device");
    }

    const session = await window.ai!.languageModel!.create({
      temperature: 0.8,
      topK: 40,
      initialPrompts: [
        {
          role: "system",
          content: `You are a creative fashion designer AI. Generate detailed clothing designs based on user descriptions.
                   Focus on practical, wearable designs with clear visual descriptions.
                   Always include fabric suggestions, color palettes, and styling details.
                   Format your response as structured text with clear sections.`,
        },
      ],
    });

    const designPrompt = `Create a detailed fashion design based on this vision: "${prompt}".

Include:
1. Main garment description with silhouette and fit
2. Fabric and material suggestions
3. Color palette (3-5 colors)
4. Key design details and embellishments
5. Styling suggestions
6. Target occasion/lifestyle

Keep it practical and achievable.`;

    const designResult = await session.prompt(designPrompt);
    session.destroy();

    let variations: string[] = [];
    if (window.ai!.writer) {
      const writerAvailability = await window.ai!.writer.availability();
      if (writerAvailability !== "no") {
        const writer = await window.ai!.writer.create({
          tone: "neutral",
          length: "medium",
          format: "plain-text",
        });

        try {
          const variation1 = await writer.write(
            `Create a casual variation of this fashion design: ${designResult.substring(0, 200)}...`,
          );
          const variation2 = await writer.write(
            `Create a formal variation of this fashion design: ${designResult.substring(0, 200)}...`,
          );
          const variation3 = await writer.write(
            `Create a sustainable/eco-friendly variation of this fashion design: ${designResult.substring(0, 200)}...`,
          );

          variations = [variation1, variation2, variation3];
        } catch (err) {
          console.warn("Failed to generate variations:", err);
        } finally {
          writer.destroy();
        }
      }
    }

    let tags: string[] = ["custom-design"];
    if (window.ai!.summarizer) {
      const summarizerAvailability =
        await window.ai!.summarizer.availability();
      if (summarizerAvailability !== "no") {
        const summarizer = await window.ai!.summarizer.create({
          type: "key-points",
          format: "plain-text",
          length: "short",
        });

        try {
          const keyPoints = await summarizer.summarize(
            `Extract 5-7 fashion keywords from this design: ${designResult}`,
          );
          tags = keyPoints
            .split(/[\n,]/)
            .map((t) => t.trim().toLowerCase())
            .filter((t) => t.length > 0);
        } catch (err) {
          console.warn("Failed to extract tags:", err);
        } finally {
          summarizer.destroy();
        }
      }
    }

    return {
      id: `design-${Date.now()}`,
      description: designResult,
      designPrompt: prompt,
      variations,
      tags,
      timestamp: Date.now(),
    };
  }

  async chatWithStylist(message: string, persona: StylistPersona): Promise<StylistResponse> {
    if (!this.checkChromeAI()) {
      throw new Error("Chrome Built-in AI not available");
    }

    const availability = await window.ai!.languageModel!.availability();
    if (availability === "no") {
      throw new Error("Language model not available on this device");
    }

    const getPersonaPrompt = (persona: StylistPersona): string => {
      const prompts = {
        luxury: `You are a luxury fashion stylist with expertise in high-end designer pieces,
              couture, and sophisticated styling. You work with premium brands and focus on
              timeless elegance, quality craftsmanship, and refined aesthetics.
              Your recommendations emphasize investment pieces and classic luxury styling.`,
        streetwear: `You are a streetwear fashion expert with deep knowledge of urban fashion,
                   sneaker culture, and contemporary trends. You stay current with drops,
                   collaborations, and emerging brands. Your style is fresh, edgy, and
                   culturally relevant with focus on comfort and self-expression.`,
        sustainable: `You are a sustainable fashion consultant specializing in eco-friendly,
                   ethical, and slow fashion. You prioritize brands with sustainable practices,
                   promote clothing longevity, and focus on versatile, high-quality pieces
                   that minimize environmental impact while maintaining style.`,
      };
      return prompts[persona];
    };

    const session = await window.ai!.languageModel!.create({
      temperature: 0.7,
      topK: 30,
      initialPrompts: [
        {
          role: "system",
          content: getPersonaPrompt(persona),
        },
      ],
    });

    const stylistPrompt = `${message}

Please provide:
1. A helpful, personalized response in your styling expertise
2. 3-5 specific clothing/styling recommendations with reasons
3. 2-3 actionable styling tips

Keep the tone friendly and professional, matching the ${persona} aesthetic.`;

    const response = await session.prompt(stylistPrompt);
    session.destroy();

    const lines = response.split("\n").filter((line) => line.trim());
    const recommendations = lines
      .filter((line) => line.includes("recommend") || line.match(/^\d+\./))
      .slice(0, 5)
      .map((line, index) => ({
        item: line.replace(/^\d+\.\s*/, "").split(":")[0] || line,
        reason: line.split(":")[1] || "Matches your style preferences",
        priority: index < 2 ? 3 : index < 4 ? 2 : 1,
      }));

    const stylingTips = lines
      .filter(
        (line) =>
          line.includes("tip") ||
          line.includes("advice") ||
          line.includes("try"),
      )
      .slice(0, 3);

    return {
      message: response,
      recommendations,
      stylingTips,
    };
  }

  async analyzePhoto(file: File): Promise<VirtualTryOnAnalysis> {
    if (!this.checkChromeAI()) {
      throw new Error("Chrome Built-in AI not available");
    }

    const availability = await window.ai!.languageModel!.availability();
    if (availability === "no") {
      throw new Error("Language model not available on this device");
    }

    const session = await window.ai!.languageModel!.create({
      temperature: 0.3,
      topK: 20,
      initialPrompts: [
        {
          role: "system",
          content: `You are a fashion fit specialist. Analyze body types and provide clothing fit recommendations.
                   Generate realistic body measurements and styling advice based on general fashion principles.
                   Always provide constructive, body-positive recommendations.`,
        },
      ],
    });

    const analysisPrompt = `Provide a virtual try-on analysis for a fashion photo. Generate:

1. General body type classification (pear, apple, hourglass, rectangle, inverted triangle)
2. Estimated measurements in general terms
3. 5 fit recommendations for different clothing types
4. 3 style adjustments for better fit and appearance

Be encouraging and focus on enhancing the person's natural features.
Keep recommendations practical and achievable.`;

    const result = await session.prompt(analysisPrompt);
    session.destroy();

    return {
      bodyType: "hourglass", // This would be extracted from AI response
      measurements: {
        shoulders: "Medium width",
        chest: "Proportioned",
        waist: "Defined",
        hips: "Balanced",
      },
      fitRecommendations: result
        .split("\n")
        .filter(
          (line) =>
            line.includes("recommendation") ||
            line.includes("fit") ||
            line.includes("size"),
        )
        .slice(0, 5),
      styleAdjustments: result
        .split("\n")
        .filter(
          (line) =>
            line.includes("style") ||
            line.includes("adjust") ||
            line.includes("enhance"),
        )
        .slice(0, 3),
    };
  }
}
