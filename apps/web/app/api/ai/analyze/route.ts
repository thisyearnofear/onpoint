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
        const { prompt, provider = 'auto' } = await request.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        let result;

        // Try to use the specified provider or auto-select
        if (provider === 'gemini' || (provider === 'auto' && gemini)) {
            if (!gemini) {
                return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
            }

            const model = gemini.getGenerativeModel({ model: 'gemini-pro' });
            const response = await model.generateContent(prompt);
            result = response.response.text();
        } else if (provider === 'openai' || (provider === 'auto' && openai)) {
            if (!openai) {
                return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
            }

            const response = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 1000,
            });
            result = response.choices[0]?.message?.content;
        } else {
            return NextResponse.json({
                error: 'No AI provider available. Please configure GEMINI_API_KEY or OPENAI_API_KEY in your environment variables.'
            }, { status: 500 });
        }

        return NextResponse.json({ result, provider: provider === 'auto' ? (gemini ? 'gemini' : 'openai') : provider });
    } catch (error) {
        console.error('AI analysis error:', error);
        return NextResponse.json({ error: 'Failed to analyze with AI' }, { status: 500 });
    }
}