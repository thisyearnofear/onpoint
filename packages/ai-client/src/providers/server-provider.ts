import { AIProvider, AnalysisInput, CritiqueResponse, DesignGeneration, StylistPersona, StylistResponse, VirtualTryOnAnalysis } from './base-provider';

export class ServerProvider implements AIProvider {
    name = "Server";
    private baseUrl: string;

    constructor(baseUrl: string = '/api/ai') {
        this.baseUrl = baseUrl;
    }

    async isAvailable(): Promise<boolean> {
        try {
            // Check if we can reach the server API and if providers are configured
            const response = await fetch(`${this.baseUrl}/status`);
            if (!response.ok) return false;

            const data = await response.json();
            return data.available;
        } catch {
            return false;
        }
    }

    async analyzeOutfit(input: AnalysisInput): Promise<CritiqueResponse> {
        try {
            const prompt = `Analyze this outfit: ${input.description || 'outfit'}. Provide feedback on style, fit, and overall look.`;

            const response = await fetch(`${this.baseUrl}/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, type: 'critique' })
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const data = await response.json();

            return {
                rating: this.extractScore(data.result),
                strengths: this.extractStrengths(data.result),
                improvements: this.extractImprovements(data.result),
                styleNotes: data.result,
                confidence: 0.8
            };
        } catch (error) {
            console.error('Server analysis error:', error);
            throw new Error('Failed to analyze outfit with server AI');
        }
    }

    async generateDesign(prompt: string): Promise<DesignGeneration> {
        try {
            const response = await fetch(`${this.baseUrl}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, type: 'design' })
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const data = await response.json();

            return {
                id: `design_${Date.now()}`,
                description: data.result,
                designPrompt: prompt,
                variations: this.extractVariations(data.result),
                tags: this.extractTags(data.result),
                timestamp: Date.now()
            };
        } catch (error) {
            console.error('Server generation error:', error);
            throw new Error('Failed to generate design with server AI');
        }
    }

    async chatWithStylist(message: string, persona: StylistPersona): Promise<StylistResponse> {
        try {
            const prompt = `As a ${persona} fashion stylist, respond to: ${message}`;

            const response = await fetch(`${this.baseUrl}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, type: 'chat' })
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const data = await response.json();

            return {
                message: data.result,
                recommendations: this.extractRecommendations(data.result),
                stylingTips: this.extractStylingTips(data.result)
            };
        } catch (error) {
            console.error('Server chat error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            if (errorMessage.includes('No AI provider available')) {
                throw new Error('AI service not configured. Please set up your API keys in the environment variables.');
            }
            throw new Error(`Failed to chat with stylist: ${errorMessage}`);
        }
    }

    async analyzePhoto(file: File): Promise<VirtualTryOnAnalysis> {
        try {
            // For now, return a mock analysis since we'd need image processing
            return {
                bodyType: 'average',
                measurements: {
                    shoulders: 'medium',
                    chest: 'medium',
                    waist: 'medium',
                    hips: 'medium'
                },
                fitRecommendations: ['Consider tailored fit', 'Pay attention to proportions'],
                styleAdjustments: ['Adjust hem length', 'Consider belt for waist definition']
            };
        } catch (error) {
            console.error('Server photo analysis error:', error);
            throw new Error('Failed to analyze photo');
        }
    }

    private extractScore(text: string): number {
        // Try to extract a score from the text
        const scoreMatch = text.match(/(\d+)\/10|(\d+)\s*out\s*of\s*10|score[:\s]*(\d+)/i);
        if (scoreMatch) {
            const scoreStr = scoreMatch[1] || scoreMatch[2] || scoreMatch[3];
            return scoreStr ? parseInt(scoreStr) : 7;
        }
        return 7; // Default score
    }

    private extractStrengths(text: string): string[] {
        const strengths: string[] = [];
        const lines = text.split('\n');

        for (const line of lines) {
            if (line && (line.includes('good') || line.includes('great') || line.includes('excellent') || line.includes('well'))) {
                strengths.push(line.trim());
            }
        }

        return strengths.length > 0 ? strengths : ['Good overall style'];
    }

    private extractImprovements(text: string): string[] {
        const improvements: string[] = [];
        const lines = text.split('\n');

        for (const line of lines) {
            if (line && (line.includes('improve') || line.includes('better') || line.includes('consider') || line.includes('try'))) {
                improvements.push(line.trim());
            }
        }

        return improvements.length > 0 ? improvements : ['Consider minor adjustments'];
    }

    private extractVariations(text: string): string[] {
        const variations: string[] = [];
        const lines = text.split('\n');

        for (const line of lines) {
            if (line && (line.includes('variation') || line.includes('alternative') || line.includes('option'))) {
                variations.push(line.trim());
            }
        }

        return variations.length > 0 ? variations : ['Classic version', 'Modern twist'];
    }

    private extractTags(text: string): string[] {
        const tags: string[] = [];
        const tagWords = ['casual', 'formal', 'elegant', 'modern', 'vintage', 'minimalist', 'bold', 'classic'];

        for (const tag of tagWords) {
            if (text.toLowerCase().includes(tag)) {
                tags.push(tag);
            }
        }

        return tags.length > 0 ? tags : ['stylish', 'fashionable'];
    }

    private extractRecommendations(text: string): Array<{ item: string; reason: string; priority: number }> {
        const recommendations: Array<{ item: string; reason: string; priority: number }> = [];
        const lines = text.split('\n');

        for (let i = 0; i < lines.length && recommendations.length < 3; i++) {
            const line = lines[i];
            if (line && (line.includes('recommend') || line.includes('suggest'))) {
                recommendations.push({
                    item: line.trim(),
                    reason: 'Based on style analysis',
                    priority: recommendations.length + 1
                });
            }
        }

        return recommendations.length > 0 ? recommendations : [
            { item: 'Consider color coordination', reason: 'Enhances overall look', priority: 1 }
        ];
    }

    private extractStylingTips(text: string): string[] {
        const tips: string[] = [];
        const lines = text.split('\n');

        for (const line of lines) {
            if (line && (line.includes('tip') || line.includes('style') || line.includes('wear') || line.includes('pair'))) {
                tips.push(line.trim());
            }
        }

        return tips.length > 0 ? tips : ['Style with confidence'];
    }
}