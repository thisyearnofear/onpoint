import { NextRequest, NextResponse } from 'next/server';
import { generateText } from '../_utils/providers';
import { corsHeaders } from '../_utils/http';

export async function POST(request: NextRequest) {
    try {
        const { prompt, type = 'design', provider = 'auto', model } = await request.json();
        const origin = request.headers.get('origin') || '*';

        if (!prompt) {
            return NextResponse.json({ error: 'Design prompt is required' }, { status: 400, headers: corsHeaders(origin) });
        }

        let result: string | undefined;
        let enhancedPrompt: string;

        // Create detailed design prompts based on type
        if (type === 'design') {
            enhancedPrompt = `As a professional fashion designer, create a detailed design based on: "${prompt}".

Include:
1. Detailed garment description with silhouette, fit, and construction details
2. Specific color palette with hex codes or color names
3. Material recommendations with fabric types and textures
4. Design elements like patterns, embellishments, or unique features
5. Styling suggestions and occasion suitability
6. 3-5 relevant fashion tags

Format your response with clear sections for each element.`;
        } else if (type === 'variation') {
            enhancedPrompt = `Create a fashion design variation of: "${prompt}".

Provide:
1. A fresh take on the original concept with different styling
2. Alternative color schemes and material choices
3. Modified silhouette or construction details
4. New design elements while maintaining the core aesthetic
5. Different occasion or styling approach

Keep the essence but make it distinctly different.`;
        } else if (type === 'refinement') {
            enhancedPrompt = `Refine and improve this fashion design: "${prompt}".

Focus on:
1. Enhanced design details and construction
2. Improved color harmony and material selection
3. Better proportions and fit considerations
4. Additional design elements for visual interest
5. Professional finishing touches and quality improvements

Provide specific improvements and reasoning.`;
        } else {
            // Default case
            enhancedPrompt = `As a professional fashion designer, create a detailed design based on: "${prompt}".`;
        }

        const modelChoice = model as ('pro' | 'flash' | 'flash-lite' | undefined);
        const { text, usedProvider } = await generateText({
            prompt: enhancedPrompt,
            provider,
            preferGemini: true,
            preferOpenAI: false,
            geminiModel: modelChoice ? (await import('../_utils/providers')).resolveGeminiModel(modelChoice) : 'gemini-2.5-flash',
            openaiModel: modelChoice ? (await import('../_utils/providers')).resolveOpenAIModel(modelChoice) : 'gpt-3.5-turbo',
            openaiOptions: { max_tokens: 1000, temperature: 0.8 },
        });
        result = text;

        // Parse the response to extract structured data
        const designData = parseDesignResponse(result || '', prompt);

        return NextResponse.json({
            ...designData,
            provider: provider === 'auto' ? usedProvider : provider,
            type
        }, { headers: corsHeaders(origin) });
    } catch (error) {
        console.error('AI design error:', error);
        return NextResponse.json({ error: 'Failed to generate design' }, { status: 500 });
    }
}

export async function OPTIONS(request: NextRequest) {
    const origin = request.headers.get('origin') || '*';
    return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

function parseDesignResponse(aiResponse: string, originalPrompt: string) {
    // Extract structured data from AI response

    // Extract colors (look for hex codes or color names)
    const colorMatches = aiResponse.match(/#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}/g) || [];
    const colorWords = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'black', 'white', 'gray', 'brown', 'navy', 'beige', 'cream', 'gold', 'silver'];
    const foundColors = colorWords.filter(color => aiResponse.toLowerCase().includes(color));
    const colors = [...colorMatches, ...foundColors].slice(0, 5);

    // Extract materials
    const materialWords = ['cotton', 'silk', 'wool', 'linen', 'denim', 'leather', 'polyester', 'cashmere', 'velvet', 'satin', 'chiffon', 'tweed', 'jersey', 'crepe'];
    const materials = materialWords.filter(material => aiResponse.toLowerCase().includes(material));

    // Extract tags
    const tagWords = ['casual', 'formal', 'elegant', 'modern', 'vintage', 'minimalist', 'bold', 'classic', 'trendy', 'sophisticated', 'edgy', 'romantic', 'sporty'];
    const tags = tagWords.filter(tag => aiResponse.toLowerCase().includes(tag));

    // Generate variations based on the response
    const variations = [
        `${originalPrompt} with different color scheme`,
        `${originalPrompt} in alternative materials`,
        `${originalPrompt} with modified silhouette`
    ];

    return {
        id: `design_${Date.now()}`,
        description: aiResponse,
        designPrompt: originalPrompt,
        colors: colors.length > 0 ? colors : ['#2C3E50', '#E74C3C', '#F39C12'],
        materials: materials.length > 0 ? materials : ['premium fabric'],
        tags: tags.length > 0 ? tags : ['stylish', 'fashionable'],
        variations,
        timestamp: Date.now()
    };
}