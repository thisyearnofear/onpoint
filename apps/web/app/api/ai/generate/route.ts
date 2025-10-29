import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

// Initialize AI clients with server-side environment variables
const gemini = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export async function POST(request: NextRequest) {
    try {
        const { prompt, provider = 'auto', type = 'design' } = await request.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        let result;
        let enhancedPrompt = prompt;

        // Enhance prompt based on type
        if (type === 'design') {
            enhancedPrompt = `As a fashion design expert, ${prompt}. Provide detailed design suggestions including colors, patterns, materials, and styling tips.`;
        } else if (type === 'critique') {
            enhancedPrompt = `As a fashion critic, analyze this outfit: ${prompt}. Provide constructive feedback on style, fit, color coordination, and overall aesthetic.`;
        }

        // Try to use the specified provider or auto-select
        if (provider === 'gemini' || (provider === 'auto' && gemini)) {
            if (!gemini) {
                return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
            }

            const model = gemini.getGenerativeModel({ model: 'gemini-pro' });
            const response = await model.generateContent(enhancedPrompt);
            result = response.response.text();
        } else if (provider === 'openai' || (provider === 'auto' && openai)) {
            if (!openai) {
                return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
            }

            const response = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: enhancedPrompt }],
                max_tokens: 1500,
            });
            result = response.choices[0]?.message?.content;
        } else {
            return NextResponse.json({ error: 'No AI provider available' }, { status: 500 });
        }

        return NextResponse.json({
            result,
            provider: provider === 'auto' ? (gemini ? 'gemini' : 'openai') : provider,
            type
        });
    } catch (error) {
        console.error('AI generation error:', error);
        return NextResponse.json({ error: 'Failed to generate with AI' }, { status: 500 });
    }
}