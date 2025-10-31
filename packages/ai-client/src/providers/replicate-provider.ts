import Replicate from "replicate";
import { VirtualTryOnAnalysis } from "./base-provider";

export class ReplicateProvider {
    private replicate: Replicate;
    private model: string;

    constructor(apiToken: string) {
        this.replicate = new Replicate({
            auth: apiToken
        });
        this.model = "cuuupid/idm-vton:0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985";
    }

    async isAvailable(): Promise<boolean> {
        try {
            // Check if the API token is valid by getting model info
            await this.replicate.models.get("cuuupid", "idm-vton");
            return true;
        } catch {
            return false;
        }
    }

    async processVirtualTryOn(garmImg: string, humanImg: string, garmentDes: string): Promise<string> {
        try {
            const input = {
                garm_img: garmImg,
                human_img: humanImg,
                garment_des: garmentDes
            };

            const output = await this.replicate.run(this.model, { input });
            
            // The output is a URL to the generated image
            if (typeof output === 'string') {
                return output;
            } else if (Array.isArray(output) && output.length > 0) {
                return output[0] as string;
            } else {
                throw new Error('Unexpected output format from Replicate API');
            }
        } catch (error) {
            console.error('Replicate API error:', error);
            throw new Error(`Failed to process virtual try-on: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async analyzeHumanImage(file: File): Promise<VirtualTryOnAnalysis> {
        // For now, we'll return a mock analysis since we don't have a specific model for this
        // In a real implementation, you might use a different Replicate model for pose detection
        return {
            bodyType: 'average',
            measurements: {
                shoulders: 'medium',
                chest: 'medium',
                waist: 'medium',
                hips: 'medium'
            },
            fitRecommendations: [
                'Consider tailored fits for a polished look',
                'Pay attention to proportions when mixing oversized and fitted pieces',
                'Choose colors that complement your skin tone'
            ],
            styleAdjustments: [
                'Adjust hem lengths for optimal proportions',
                'Consider belt placement to define waist',
                'Balance volume between top and bottom pieces'
            ]
        };
    }

    // New method for fashion image analysis using GPT-4o-mini
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

    // New method for personality-specific critiques
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

    // Helper method to parse vision analysis
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
}
}