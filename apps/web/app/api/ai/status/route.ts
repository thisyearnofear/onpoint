import { NextResponse } from 'next/server';

export async function GET() {
    const hasGemini = !!process.env.GEMINI_API_KEY;
    const hasOpenAI = !!process.env.OPENAI_API_KEY;

    return NextResponse.json({
        available: hasGemini || hasOpenAI,
        providers: {
            gemini: hasGemini,
            openai: hasOpenAI
        }
    });
}