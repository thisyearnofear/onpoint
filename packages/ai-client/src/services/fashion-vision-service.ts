import Replicate from "replicate";
import { VirtualTryOnAnalysis } from "../providers/base-provider";

export class FashionVisionService {
    private replicate: Replicate;

    constructor(apiToken: string) {
        this.replicate = new Replicate({
            auth: apiToken
        });
    }

    /**
     * Analyze a fashion image using GPT-4o-mini
     * @param imageBase64 Base64 encoded image
     * @returns Analysis results including outfit description, colors, style, and critique
     */
    async analyzeFashionImage(imageBase64: string): Promise<any> {
        try {
            const input = {
                prompt: `You are a fashion expert AI assistant. Analyze this image and provide a detailed fashion critique.
                
                Please provide:
                1. Description of the outfit (clothing items, style)
                2. Color palette analysis
                3. Fit assessment
                4. Style coherence evaluation
                5. Strengths of the look
                6. Areas for improvement
                7. Overall rating (1-10)
                
                Be specific, honest, and provide actionable feedback.`,
                image_input: `data:image/jpeg;base64,${imageBase64}`,
                system_prompt: "You are a professional fashion stylist and critic with expertise in multiple fashion domains.",
                max_completion_tokens: 2000,
                temperature: 0.7
            };

            const output = await this.replicate.run("openai/gpt-4o-mini", { input });
            
            // Handle different output formats
            let resultText = "";
            if (typeof output === 'string') {
                resultText = output;
            } else if (Array.isArray(output)) {
                resultText = output.join('');
            } else if (typeof output === 'object' && output !== null) {
                resultText = JSON.stringify(output);
            }

            return this.parseVisionAnalysis(resultText);
        } catch (error) {
            console.error('Fashion vision analysis error:', error);
            throw new Error(`Failed to analyze fashion image: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get personality-specific critique
     * @param imageBase64 Base64 encoded image
     * @param persona Stylist persona
     * @returns Personality-specific critique
     */
    async getPersonalityCritique(imageBase64: string, persona: string): Promise<string> {
        try {
            const personaPrompts: Record<string, string> = {
                luxury: `As a luxury fashion expert, provide an sophisticated critique of this outfit. 
                Focus on high-end styling, investment pieces, and timeless elegance.`,
                
                streetwear: `As a streetwear guru, give an urban and contemporary critique of this outfit.
                Focus on current trends, sneaker culture, and bold styling choices.`,
                
                sustainable: `As a sustainable fashion consultant, provide an eco-friendly critique of this outfit.
                Focus on ethical brands, sustainable materials, and conscious wardrobe choices.`,
                
                edina: `As Edina Monsoon from Absolutely Fabulous, give a fabulous and dramatic critique of this outfit.
                Be outrageous, witty, and absolutely fabulous in your assessment!`,
                
                miranda: `As Miranda Priestly from The Devil Wears Prada, provide a brutally honest but sophisticated critique.
                Be direct, demanding perfection, and focus on high fashion standards.`,
                
                shaft: `As John Shaft, give a cool, confident critique with 1970s style flair.
                Focus on classic menswear, sophisticated edge, and timeless cool.`
            };

            const input = {
                prompt: `${personaPrompts[persona] || personaPrompts.luxury}
                
                Analyze this image and provide your signature style of critique.
                Be authentic to your personality while providing valuable fashion feedback.`,
                image_input: `data:image/jpeg;base64,${imageBase64}`,
                system_prompt: "You are a professional fashion stylist with a distinct personality.",
                max_completion_tokens: 1500,
                temperature: 0.8
            };

            const output = await this.replicate.run("openai/gpt-4o-mini", { input });
            
            // Handle different output formats
            if (typeof output === 'string') {
                return output;
            } else if (Array.isArray(output)) {
                return output.join('');
            } else if (typeof output === 'object' && output !== null) {
                return JSON.stringify(output);
            }
            
            return "Critique generated successfully.";
        } catch (error) {
            console.error('Personality critique error:', error);
            throw new Error(`Failed to generate ${persona} critique: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Parse the vision analysis output into structured data
     * @param analysisText Raw analysis text from the model
     * @returns Structured analysis object
     */
    private parseVisionAnalysis(analysisText: string): any {
        // This is a simplified parser - in production, you might want to use more sophisticated NLP
        const lines = analysisText.split('\n').filter(line => line.trim() !== '');
        
        // Extract rating if present
        const ratingMatch = analysisText.match(/(?:rating|score).*?(\d+(?:\.\d+)?)/i);
        const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 7;
        
        // Extract key sections
        const strengths: string[] = [];
        const improvements: string[] = [];
        
        let inStrengths = false;
        let inImprovements = false;
        
        for (const line of lines) {
            if (line.toLowerCase().includes('strength') || line.toLowerCase().includes('good')) {
                inStrengths = true;
                inImprovements = false;
            } else if (line.toLowerCase().includes('improv') || line.toLowerCase().includes('better')) {
                inStrengths = false;
                inImprovements = true;
            }
            
            if (inStrengths && line.trim() !== '' && !line.toLowerCase().includes('strength')) {
                strengths.push(line.trim());
            } else if (inImprovements && line.trim() !== '' && !line.toLowerCase().includes('improv')) {
                improvements.push(line.trim());
            }
        }
        
        return {
            fullAnalysis: analysisText,
            rating: Math.min(10, Math.max(1, rating)),
            strengths: strengths.slice(0, 5),
            improvements: improvements.slice(0, 5),
            styleNotes: "Analysis completed successfully"
        };
    }

    /**
     * Compare two outfits
     * @param image1Base64 Base64 encoded first image
     * @param image2Base64 Base64 encoded second image
     * @returns Comparison analysis
     */
    async compareOutfits(image1Base64: string, image2Base64: string): Promise<string> {
        try {
            const input = {
                prompt: `Compare these two fashion images and provide a detailed comparison.
                
                For each outfit, analyze:
                1. Style and aesthetic
                2. Color coordination
                3. Fit and proportions
                4. Occasion appropriateness
                
                Then compare them directly, explaining which is more effective and why.`,
                image_input: [
                    `data:image/jpeg;base64,${image1Base64}`,
                    `data:image/jpeg;base64,${image2Base64}`
                ],
                system_prompt: "You are a professional fashion stylist specializing in outfit comparisons.",
                max_completion_tokens: 2500,
                temperature: 0.7
            };

            const output = await this.replicate.run("openai/gpt-4o-mini", { input });
            
            if (typeof output === 'string') {
                return output;
            } else if (Array.isArray(output)) {
                return output.join('');
            } else if (typeof output === 'object' && output !== null) {
                return JSON.stringify(output);
            }
            
            return "Comparison completed successfully.";
        } catch (error) {
            console.error('Outfit comparison error:', error);
            throw new Error(`Failed to compare outfits: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}