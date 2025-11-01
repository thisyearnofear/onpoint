import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProvider, AnalysisInput, CritiqueResponse, DesignGeneration, StylistPersona, StylistResponse, VirtualTryOnAnalysis } from "./base-provider";

export class GeminiProvider implements AIProvider {
  name = "Gemini";
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
  }

  async analyzeOutfit(input: AnalysisInput): Promise<CritiqueResponse> {
    const prompt = this.buildFashionAnalysisPrompt(input);
    const result = await this.model.generateContent(prompt);
    return this.parseCritiqueResponse(result.response.text());
  }

  async generateDesign(prompt: string): Promise<DesignGeneration> {
    const designPrompt = this.buildDesignPrompt(prompt);
    const result = await this.model.generateContent(designPrompt);
    return this.parseDesignResponse(result.response.text(), prompt);
  }

  async chatWithStylist(message: string, persona: StylistPersona): Promise<StylistResponse> {
    const stylistPrompt = this.buildStylistPrompt(message, persona);
    const result = await this.model.generateContent(stylistPrompt);
    return this.parseStylistResponse(result.response.text());
  }

  async analyzePhoto(file: File): Promise<VirtualTryOnAnalysis> {
    const imageData = await this.fileToGenerativePart(file);
    const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-pro-vision" });

    const prompt = `Analyze this fashion photo:
  1. Identify body type and proportions
  2. Suggest measurements (general terms)
  3. Provide 5 fit recommendations
  4. Give 3 style improvement suggestions
  
  Be body-positive and constructive.`;

    const result = await model.generateContent([prompt, imageData]);
    return this.parseVirtualTryOnResponse(result.response.text());
  }

  private async fileToGenerativePart(file: File) {
    // Convert a browser File object to the format expected by Gemini
    const base64 = await this.fileToBase64(file);
    return {
      inlineData: {
        data: base64,
        mimeType: file.type,
      },
    };
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        // Remove the data URL prefix (e.g., "data:image/jpeg;base64,") and return only the base64 string
        const result = reader.result as string;
        if (result) {
          const base64String = result.split(',')[1];
          if (base64String) {
            resolve(base64String);
          } else {
            reject(new Error('Failed to extract base64 string'));
          }
        } else {
          reject(new Error('Failed to read file as base64'));
        }
      };
      reader.onerror = reject;
    });
  }

  private buildFashionAnalysisPrompt(input: AnalysisInput): string {
    return `You are a professional fashion critic. Analyze this outfit and provide:
    1. Overall rating (1-10) with explanation
    2. 3-4 specific strengths
    3. 2-3 areas for improvement
    4. Style notes
    5. Confidence level
    
    ${input.description ? `Description: ${input.description}` : ''}
    
    Format as JSON with fields: rating, strengths[], improvements[], styleNotes, confidence`;
  }

  private buildDesignPrompt(prompt: string): string {
    return `Create a detailed fashion design based on this vision: "${prompt}".

Include:
1. Main garment description with silhouette and fit
2. Fabric and material suggestions
3. Color palette (3-5 colors)
4. Key design details and embellishments
5. Styling suggestions
6. Target occasion/lifestyle

Keep it practical and achievable.`;
  }

  private buildStylistPrompt(message: string, persona: StylistPersona): string {
    return `${message}

Please provide:
1. A helpful, personalized response in your styling expertise
2. 3-5 specific clothing/styling recommendations with reasons
3. 2-3 actionable styling tips

Keep the tone friendly and professional, matching the ${persona} aesthetic.`;
  }

  private parseCritiqueResponse(response: string): CritiqueResponse {
    try {
      return JSON.parse(response);
    } catch (error) {
      console.error("Failed to parse critique response:", error);
      // Implement a more robust parsing logic here, potentially using a different format or a more resilient parser
      return {
        rating: 0,
        strengths: [],
        improvements: [],
        styleNotes: "",
        confidence: 0,
      };
    }
  }

  private parseDesignResponse(response: string, prompt: string): DesignGeneration {
    return {
      id: `design-${Date.now()}`,
      description: response,
      designPrompt: prompt,
      variations: [],
      tags: [],
      timestamp: Date.now(),
    };
  }

  private parseStylistResponse(response: string): StylistResponse {
    const lines = response.split('\n').filter((line) => line.trim());
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

  private parseVirtualTryOnResponse(response: string): VirtualTryOnAnalysis {
    // Implement parsing logic for virtual try-on response
    return {
      bodyType: "",
      measurements: {
        shoulders: "",
        chest: "",
        waist: "",
        hips: "",
      },
      fitRecommendations: [],
      styleAdjustments: [],
    };
  }
}
