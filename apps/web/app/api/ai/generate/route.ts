import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

// Initialize AI clients with server-side environment variables
const gemini = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here'
    ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const openai = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here'
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export async function POST(request: NextRequest) {
    try {
        const { prompt, provider = 'auto', type = 'design' } = await request.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
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

        const shouldUseGemini = provider === 'gemini' ||
            (provider === 'auto' && isCharacterPersona && gemini);
        const shouldUseOpenAI = provider === 'openai' ||
            (provider === 'auto' && isProfessionalPersona && openai);

        // Try to use the specified provider or auto-select
        if (shouldUseGemini && gemini) {
            const model = gemini.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
            const response = await model.generateContent(enhancedPrompt);
            const textResult = response.response.text();
            result = textResult === null ? undefined : textResult;
        } else if (shouldUseOpenAI && openai) {
            const response = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: enhancedPrompt }],
                max_tokens: type === 'chat' ? 300 : 1500,
            });
            const openaiResult = response.choices[0]?.message?.content;
            result = openaiResult === null ? undefined : openaiResult;
        } else if (provider === 'openai' && !openai) {
            return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
        } else if (provider === 'gemini' && !gemini) {
            return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
        } else {
            return NextResponse.json({
                error: 'No AI provider available. Please configure GEMINI_API_KEY or OPENAI_API_KEY in your environment variables.'
            }, { status: 500 });
        }

        // Determine which provider was actually used
        let actualProvider = provider;
        if (provider === 'auto') {
            if (shouldUseGemini && gemini) {
                actualProvider = 'gemini';
            } else if (shouldUseOpenAI && openai) {
                actualProvider = 'openai';
            } else {
                actualProvider = gemini ? 'gemini' : 'openai';
            }
        }

        return NextResponse.json({
            result,
            provider: actualProvider,
            type
        });
    } catch (error) {
        console.error('AI generation error:', error);
        return NextResponse.json({ error: 'Failed to generate with AI' }, { status: 500 });
    }
}