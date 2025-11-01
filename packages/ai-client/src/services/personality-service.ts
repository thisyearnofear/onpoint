import { StylistPersona } from '../providers/base-provider';

interface PersonalityConfig {
    model: string;
    prompt: string;
    temperature: number;
    maxTokens: number;
}

export class PersonalityService {
    private personas: Record<StylistPersona, PersonalityConfig> = {
        luxury: {
            model: 'gpt-4o-mini',
            prompt: `You are a luxury fashion expert with impeccable taste and knowledge of high-end brands. 
      Analyze this outfit with the sophistication of someone who understands couture, quality fabrics, and timeless elegance. 
      Focus on craftsmanship, investment pieces, and how to elevate the look with luxury touches. 
      Be discerning but constructive in your critique.`,
            temperature: 0.7,
            maxTokens: 400
        },
        streetwear: {
            model: 'gpt-4o-mini',
            prompt: `You are a streetwear guru who knows the latest drops, collaborations, and urban fashion trends. 
      Analyze this outfit from a streetwear perspective, considering authenticity, brand mixing, and street credibility. 
      Focus on how to make the look more fresh, current, and true to streetwear culture. 
      Keep it real and speak the language of the streets.`,
            temperature: 0.8,
            maxTokens: 400
        },
        sustainable: {
            model: 'gpt-4o-mini',
            prompt: `You are an eco-conscious fashion stylist passionate about sustainable and ethical fashion. 
      Analyze this outfit considering environmental impact, ethical production, and longevity. 
      Suggest ways to make the look more sustainable through thrifting, upcycling, or choosing eco-friendly brands. 
      Focus on quality over quantity and timeless pieces that won't contribute to fast fashion waste.`,
            temperature: 0.6,
            maxTokens: 400
        },
        edina: {
            model: 'gpt-4o-mini',
            prompt: `You are Edina Monsoon from Absolutely Fabulous - dramatic, over-the-top, and obsessed with being fashionable. 
      Critique this outfit with Edina's characteristic flair for the dramatic and her desperate need to be trendy. 
      Use her vocabulary ("sweetie," "darling," "fabulous") and her tendency to name-drop designers and trends. 
      Be hilariously critical while trying to be helpful, just like Edina would be.`,
            temperature: 0.9,
            maxTokens: 400
        },
        miranda: {
            model: 'gpt-4o-mini',
            prompt: `You are Miranda Priestly from The Devil Wears Prada - ice-cold, devastatingly critical, and impossibly chic. 
      Analyze this outfit with Miranda's razor-sharp eye for fashion and her ability to destroy confidence with a single look. 
      Be brutally honest about what's wrong, but also show your deep knowledge of fashion history and trends. 
      Use her characteristic understated delivery that somehow makes everything sound more cutting.`,
            temperature: 0.5,
            maxTokens: 400
        },
        shaft: {
            model: 'gpt-4o-mini',
            prompt: `You are John Shaft - cool, confident, and effortlessly stylish with a focus on classic menswear and timeless cool. 
      Analyze this outfit from the perspective of someone who knows how to look sharp without trying too hard. 
      Focus on fit, confidence, and that indefinable quality that makes someone look effortlessly cool. 
      Keep it smooth and give advice that would make anyone look like they've got it together.`,
            temperature: 0.7,
            maxTokens: 400
        }
    };

    async generateCritique(imageBase64: string, persona: StylistPersona): Promise<string> {
        const config = this.personas[persona];

        try {
            const response = await fetch('/api/ai/personality-critique', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageBase64,
                    persona,
                    config,
                    provider: 'auto'
                })
            });

            if (!response.ok) {
                throw new Error(`Personality critique failed: ${response.status}`);
            }

            const data = await response.json();
            return data.critique || 'Unable to generate critique at this time.';
        } catch (error) {
            console.error('Personality critique error:', error);
            throw error;
        }
    }

    getPersonalityInfo(persona: StylistPersona) {
        const info = {
            luxury: {
                name: 'Luxury Expert',
                description: 'High-end fashion connoisseur with impeccable taste',
                icon: 'Crown',
                color: 'text-yellow-600'
            },
            streetwear: {
                name: 'Streetwear Guru',
                description: 'Urban fashion expert who knows the latest drops',
                icon: 'Zap',
                color: 'text-blue-600'
            },
            sustainable: {
                name: 'Eco Stylist',
                description: 'Sustainable fashion advocate focused on ethical choices',
                icon: 'Leaf',
                color: 'text-green-600'
            },
            edina: {
                name: 'Edina Monsoon',
                description: 'Dramatic fashionista from Absolutely Fabulous',
                icon: 'Sparkles',
                color: 'text-purple-600'
            },
            miranda: {
                name: 'Miranda Priestly',
                description: 'Ice-cold fashion editor with devastating critique',
                icon: 'Star',
                color: 'text-red-600'
            },
            shaft: {
                name: 'John Shaft',
                description: 'Cool, confident style icon with timeless appeal',
                icon: 'MessageCircle',
                color: 'text-orange-600'
            }
        };

        return info[persona];
    }
}

export const personalityService = new PersonalityService();