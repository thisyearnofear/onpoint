import { NextRequest, NextResponse } from 'next/server';
import { generateText } from '../_utils/providers';
import { corsHeaders } from '../_utils/http';

export async function POST(request: NextRequest) {
    try {
        const { imageBase64, persona, config, provider = 'auto' } = await request.json();
        const origin = request.headers.get('origin') || '*';

        if (!imageBase64 || !persona || !config) {
            return NextResponse.json({
                error: 'Image data, persona, and config are required'
            }, {
                status: 400,
                headers: corsHeaders(origin)
            });
        }

        // Create the enhanced prompt for personality-based critique
        const enhancedPrompt = `${config.prompt}

Please analyze the outfit in this image and provide a critique that matches your personality and expertise. 
Consider:
1. Overall style and aesthetic
2. Fit and proportions
3. Color coordination
4. Appropriateness for different occasions
5. Specific improvements or suggestions
6. What's working well

Keep your response engaging and true to your character while being genuinely helpful.`;

        // For now, we'll use text-based analysis since image analysis requires special handling
        // In a production environment, you'd process the actual image
        const { text, usedProvider } = await generateText({
            prompt: enhancedPrompt,
            provider,
            preferGemini: false,
            preferOpenAI: true,
            geminiModel: 'gemini-2.5-flash',
            openaiModel: config.model || 'gpt-4o-mini',
            openaiOptions: {
                max_tokens: config.maxTokens || 400,
                temperature: config.temperature || 0.7
            },
        });

        return NextResponse.json({
            critique: text || 'Unable to generate critique at this time.',
            persona,
            provider: provider === 'auto' ? usedProvider : provider
        }, { headers: corsHeaders(origin) });
    } catch (error) {
        console.error('AI personality critique error:', error);
        return NextResponse.json({
            error: 'Failed to generate personality critique'
        }, {
            status: 500
        });
    }
}

export async function OPTIONS(request: NextRequest) {
    const origin = request.headers.get('origin') || '*';
    return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}