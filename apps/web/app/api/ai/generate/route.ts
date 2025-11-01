import { NextRequest, NextResponse } from 'next/server';
import { generateText } from '../_utils/providers';
import { corsHeaders } from '../_utils/http';

export async function POST(request: NextRequest) {
    try {
        const { prompt, provider = 'auto', type = 'design', model } = await request.json();
        const origin = request.headers.get('origin') || '*';

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400, headers: corsHeaders(origin) });
        }

        let result: string | undefined;
        let enhancedPrompt: string = prompt;

        // Enhance prompt based on type
        if (type === 'design') {
            enhancedPrompt = `As a fashion design expert, ${prompt}. Provide detailed design suggestions including colors, patterns, materials, and styling tips.`;
        } else if (type === 'critique') {
            enhancedPrompt = `As a fashion critic, analyze this outfit: ${prompt}. Provide constructive feedback on style, fit, color coordination, and overall aesthetic.`;
        } else if (type === 'chat') {
            // Extract persona from the prompt (it should be in the format "As a {persona} fashion stylist, respond to: {message}")
            const personaMatch = prompt.match(/As a (\w+) fashion stylist, respond to: (.+)/);
            const persona = personaMatch ? personaMatch[1] : 'luxury';
            const actualMessage = personaMatch ? personaMatch[2] : prompt;

            const personaPrompts = {
                luxury: "You are a luxury fashion stylist. Speak with sophistication and elegance. Focus on high-end pieces, timeless style, and quality investment pieces.",
                streetwear: "You are a streetwear expert. Keep it fresh, edgy, and current. Focus on urban fashion, sneakers, and contemporary trends.",
                sustainable: "You are a sustainable fashion consultant. Emphasize eco-friendly choices, ethical brands, and versatile pieces that last.",
                edina: "You are Edina Monsoon from Absolutely Fabulous! Darling, you're absolutely obsessed with fashion trends, over-the-top styling, and being fabulous. Use dramatic language, call everyone 'sweetie' or 'darling', and suggest bold, avant-garde pieces. You're a fashion victim in the best way possible!",
                miranda: "You are Miranda Priestly from The Devil Wears Prada. You are the formidable editor-in-chief with impeccable taste and commanding presence. Speak with authority and sophistication. Focus on sharp tailoring, high-fashion pieces, and powerful statement looks. Your standards are impossibly high.",
                shaft: "You are channeling John Shaft's iconic 1970s style expertise. You're cool, confident, and know how to put together a look that commands respect. Focus on leather jackets, turtlenecks, fitted pants, and accessories that make a statement. Keep it smooth and sophisticated with an edge."
            };

            const personaPrompt = personaPrompts[persona as keyof typeof personaPrompts] || personaPrompts.luxury;
            enhancedPrompt = `${personaPrompt}\n\nUser question: ${actualMessage}\n\nRespond in 2-3 short paragraphs max. Include 2-3 specific recommendations with brief reasons. Keep your tone matching the ${persona} aesthetic. Be concise and actionable.`;
        }

        // Character personas default to Gemini for more creative responses
        const personaMatch = prompt.match(/As a (\w+) fashion stylist, respond to: (.+)/);
        const persona = personaMatch ? personaMatch[1] : 'luxury';
        const isCharacterPersona = ['edina', 'miranda', 'shaft'].includes(persona);
        const isProfessionalPersona = ['luxury', 'streetwear', 'sustainable'].includes(persona);

        const preferGemini = provider === 'gemini' || (provider === 'auto' && isCharacterPersona);
        const preferOpenAI = provider === 'openai' || (provider === 'auto' && isProfessionalPersona);

        // Optional model selection per request
        const modelChoice = model as ('pro' | 'flash' | 'flash-lite' | undefined);

        const { text, usedProvider } = await generateText({
            prompt: enhancedPrompt,
            provider,
            preferGemini,
            preferOpenAI,
            geminiModel: modelChoice ? (await import('../_utils/providers')).resolveGeminiModel(modelChoice) : 'gemini-2.5-flash',
            openaiModel: modelChoice ? (await import('../_utils/providers')).resolveOpenAIModel(modelChoice) : 'gpt-3.5-turbo',
            openaiOptions: { max_tokens: type === 'chat' ? 300 : 1500 },
        });
        result = text;

        // Determine which provider was actually used
        const actualProvider = provider === 'auto' ? usedProvider : provider;

        return NextResponse.json({
            result,
            provider: actualProvider,
            type
        }, { headers: corsHeaders(origin) });
    } catch (error) {
        console.error('AI generation error:', error);
        return NextResponse.json({ error: 'Failed to generate with AI' }, { status: 500 });
    }
}

export async function OPTIONS(request: NextRequest) {
    const origin = request.headers.get('origin') || '*';
    return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}