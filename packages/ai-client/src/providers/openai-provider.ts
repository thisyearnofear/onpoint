import OpenAI from 'openai';
import { AIProvider, AnalysisInput, CritiqueResponse, DesignGeneration, StylistPersona, StylistResponse, VirtualTryOnAnalysis } from "./base-provider";

export class OpenAIProvider implements AIProvider {
  name = "OpenAI";
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
      dangerouslyAllowBrowser: true // Only for client-side usage
    });
  }

  async analyzeOutfit(input: AnalysisInput): Promise<CritiqueResponse> {
    const messages = [
      {
        role: "system" as const,
        content: "You are a professional fashion stylist providing constructive outfit analysis."
      },
      {
        role: "user" as const,
        content: this.buildAnalysisPrompt(input)
      }
    ];

    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      response_format: { type: "json_object" }
    });

    const choice = response.choices[0];
    if (!choice || !choice.message || !choice.message.content) {
      throw new Error('No content in OpenAI response');
    }
    return JSON.parse(choice.message.content);
  }

  async generateDesign(prompt: string): Promise<DesignGeneration> {
    const messages = [
      {
        role: "system" as const,
        content: "You are a creative fashion designer AI. Generate detailed clothing designs based on user descriptions. Focus on practical, wearable designs with clear visual descriptions. Include fabric suggestions, color palettes, and styling details."
      },
      {
        role: "user" as const,
        content: `Create a detailed fashion design based on this vision: "${prompt}". Include: 1. Main garment description with silhouette and fit, 2. Fabric and material suggestions, 3. Color palette (3-5 colors), 4. Key design details and embellishments, 5. Styling suggestions, 6. Target occasion/lifestyle. Keep it practical and achievable.`
      }
    ];

    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      response_format: { type: "json_object" }
    });

    const choice = response.choices[0];
    if (!choice || !choice.message || !choice.message.content) {
      throw new Error('No content in OpenAI response');
    }
    return {
      id: `design-${Date.now()}`,
      description: choice.message.content,
      designPrompt: prompt,
      variations: [],
      tags: [],
      timestamp: Date.now(),
    };
  }

  async chatWithStylist(message: string, persona: StylistPersona): Promise<StylistResponse> {
    const getPersonaPrompt = (persona: StylistPersona): string => {
      const prompts = {
        luxury: "You are a luxury fashion stylist with expertise in high-end designer pieces, couture, and sophisticated styling. You work with premium brands and focus on timeless elegance, quality craftsmanship, and refined aesthetics. Your recommendations emphasize investment pieces and classic luxury styling.",
        streetwear: "You are a streetwear fashion expert with deep knowledge of urban fashion, sneaker culture, and contemporary trends. You stay current with drops, collaborations, and emerging brands. Your style is fresh, edgy, and culturally relevant with focus on comfort and self-expression.",
        sustainable: "You are a sustainable fashion consultant specializing in eco-friendly, ethical, and slow fashion. You prioritize brands with sustainable practices, promote clothing longevity, and focus on versatile, high-quality pieces that minimize environmental impact while maintaining style."
      };
      return prompts[persona];
    };

    const messages = [
      {
        role: "system" as const,
        content: getPersonaPrompt(persona)
      },
      {
        role: "user" as const,
        content: `${message}\n\nPlease provide: 1. A helpful, personalized response in your styling expertise, 2. 3-5 specific clothing/styling recommendations with reasons, 3. 2-3 actionable styling tips. Keep the tone friendly and professional, matching the ${persona} aesthetic.`
      }
    ];

    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      response_format: { type: "json_object" }
    });

    // Parse the response into structured format
    const choice = response.choices[0];
    if (!choice || !choice.message || !choice.message.content) {
      throw new Error('No content in OpenAI response');
    }
    const content = choice.message.content;
    try {
      const parsedResponse = JSON.parse(content);
      return {
        message: parsedResponse.message || content,
        recommendations: parsedResponse.recommendations || [
          { item: "General recommendation", reason: "Based on your preferences", priority: 1 }
        ],
        stylingTips: parsedResponse.stylingTips || ["General styling tip"]
      };
    } catch (error) {
      // Fallback parsing if JSON parsing fails
      const lines = content.split('\n').filter(line => line.trim());
      const recommendations = lines
        .filter(line => line.includes("recommend") || line.match(/^\d+\./))
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
        message: content,
        recommendations,
        stylingTips,
      };
    }
  }

  async analyzePhoto(file: File): Promise<VirtualTryOnAnalysis> {
    // For now, we'll handle the file by converting it to a data URL
    // In a real implementation, we'd need to upload to a service that can process images
    // or use a model that supports image inputs like GPT-4 Vision

    const messages = [
      {
        role: "system" as const,
        content: "You are a fashion fit specialist. Analyze body types and provide clothing fit recommendations. Generate realistic body measurements and styling advice based on general fashion principles. Always provide constructive, body-positive recommendations."
      },
      {
        role: "user" as const,
        content: "Analyze this fashion photo. Generate: 1. General body type classification (pear, apple, hourglass, rectangle, inverted triangle), 2. Estimated measurements in general terms, 3. 5 fit recommendations for different clothing types, 4. 3 style adjustments for better fit and appearance. Be encouraging and focus on enhancing the person's natural features. Keep recommendations practical and achievable."
      }
    ];

    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      response_format: { type: "json_object" }
    });

    // For now, return a generic response until we implement proper image handling
    // In a real implementation, we would send the image data to the model that supports vision
    return {
      bodyType: "varies",
      measurements: {
        shoulders: "Standard width",
        chest: "Standard",
        waist: "Standard",
        hips: "Standard",
      },
      fitRecommendations: [
        "General fit recommendation 1",
        "General fit recommendation 2",
        "General fit recommendation 3",
        "General fit recommendation 4",
        "General fit recommendation 5"
      ],
      styleAdjustments: [
        "General style adjustment 1",
        "General style adjustment 2",
        "General style adjustment 3"
      ],
    };
  }

  private buildAnalysisPrompt(input: AnalysisInput): string {
    return `Analyze this outfit and provide:
    1. Overall rating (1-10) with explanation
    2. 3-4 specific strengths
    3. 2-3 areas for improvement
    4. Style notes
    5. Confidence level
    
    ${input.description ? `Description: ${input.description}` : ''}`;
  }
}
