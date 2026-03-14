import { NextRequest, NextResponse } from 'next/server';
import { corsHeaders } from '../_utils/http';

export async function POST(request: NextRequest) {
    try {
        const origin = request.headers.get('origin') || '*';
        
        // In a production environment, you would perform user authentication here
        // Optional: Check rate limits for this user's live session instantiation.
        const geminiApiKey = process.env.GEMINI_API_KEY;
        if (!geminiApiKey) {
            return NextResponse.json({ error: 'Gemini API key not configured on server' }, { status: 500, headers: corsHeaders(origin) });
        }

        console.log('Provisioning Live AR Session...');

        // Return the required configuration for the frontend to securely connect to the websocket
        return NextResponse.json({
            config: {
                apiKey: geminiApiKey,
                baseURL: 'wss://generativelanguage.googleapis.com/ws',
                model: 'models/gemini-2.0-flash-exp'
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
