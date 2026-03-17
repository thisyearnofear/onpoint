import { NextRequest, NextResponse } from 'next/server';
import { corsHeaders } from '../_utils/http';

export async function POST(request: NextRequest) {
    try {
        const origin = request.headers.get('origin') || '*';
        const { goal = 'daily', apiKey } = await request.json().catch(() => ({}));
        const byok = typeof apiKey === 'string' ? apiKey.trim() : '';
        
        // In a production environment, you would perform user authentication here
        // Optional: Check rate limits for this user's live session instantiation.
        const geminiApiKey = byok || process.env.VERTEX_API_KEY || process.env.GEMINI_API_KEY;
        if (!geminiApiKey) {
            return NextResponse.json(
                {
                    error: 'Live Stylist is unavailable right now. Add your Gemini API key to continue.',
                    byokRequired: true,
                },
                { status: 500, headers: corsHeaders(origin) }
            );
        }

        const goalInstructions: Record<string, string> = {
            event: 'You are a celebrity stylist helping the user prepare for a special event. Focus on: outfit appropriateness for the event type, formal/casual balance, standout accessories, and confidence-boosting suggestions. Be specific about what works and what to avoid for their event.',
            daily: 'You are a personal stylist reviewing the user\'s everyday outfit. Focus on: fit, color coordination, proportions, versatility, and small tweaks that elevate a casual look. Keep suggestions practical and actionable.',
            critique: 'You are a blunt, honest fashion critic giving real talk about the user\'s outfit. Focus on: what\'s working, what\'s not, specific improvements, and honest ratings. Be direct but constructive — no sugarcoating.',
        };

        console.log('Provisioning Live AR Session...', { goal, usingByok: Boolean(byok) });

        // Return the required configuration for the frontend to securely connect to the websocket
        return NextResponse.json({
            config: {
                apiKey: geminiApiKey,
                baseURL: 'wss://generativelanguage.googleapis.com/ws',
                model: 'models/gemini-3.1-flash-lite-preview',
                systemInstruction: goalInstructions[goal] || goalInstructions.daily,
            }
        }, { headers: corsHeaders(origin) });

    } catch (error) {
        console.error('Live Session provisioning error:', error);
        return NextResponse.json({ error: 'Failed to provision session' }, { status: 500 });
    }
}

export async function OPTIONS(request: NextRequest) {
    const origin = request.headers.get('origin') || '*';
    return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}
