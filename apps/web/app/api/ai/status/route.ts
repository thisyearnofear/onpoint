import { NextResponse } from 'next/server';

export async function GET() {
    const hasGemini = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here';
    const hasOpenAI = !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here';

    return NextResponse.json({
        available: hasGemini || hasOpenAI,
        providers: {
            gemini: hasGemini,
            openai: hasOpenAI
        },
        message: hasGemini || hasOpenAI ? 'AI providers configured' : 'Please configure GEMINI_API_KEY or OPENAI_API_KEY in your environment variables'
    });
}