import { NextRequest, NextResponse } from 'next/server';
import { generateText } from '../_utils/providers';
import { corsHeaders } from '../_utils/http';

export async function POST(request: NextRequest) {
    try {
        const { description, style = 'modern', season = 'all-season', provider = 'auto', model } = await request.json();
        const origin = request.headers.get('origin') || '*';

        if (!description) {
            return NextResponse.json({ error: 'Color palette description is required' }, { status: 400, headers: corsHeaders(origin) });
        }

        let result: string | undefined;
        const enhancedPrompt = `As a professional color consultant and fashion stylist, create a cohesive color palette for: "${description}".

Style preference: ${style}
Season consideration: ${season}

Provide:
1. 5-7 specific colors with exact names (like "Deep Navy", "Warm Ivory", "Sage Green")
2. Hex color codes for each color (e.g., #1A365D)
3. Brief description of why each color works in this palette
4. How the colors complement each other
5. Styling suggestions for using these colors together
6. Occasion suitability (casual, formal, versatile)

Format your response clearly with color names, hex codes, and explanations.`;

        const modelChoice = model as ('pro' | 'flash' | 'flash-lite' | undefined);
        const { text, usedProvider } = await generateText({
            prompt: enhancedPrompt,
            provider,
            preferGemini: true,
            preferOpenAI: false,
            geminiModel: modelChoice ? (await import('../_utils/providers')).resolveGeminiModel(modelChoice) : 'gemini-2.5-flash',
            openaiModel: modelChoice ? (await import('../_utils/providers')).resolveOpenAIModel(modelChoice) : 'gpt-3.5-turbo',
            openaiOptions: { max_tokens: 800, temperature: 0.8 },
        });
        result = text;

        // Parse the response to extract color data
        const paletteData = parseColorPaletteResponse(result || '', description, style, season);

        return NextResponse.json({
            ...paletteData,
            provider: provider === 'auto' ? usedProvider : provider
        }, { headers: corsHeaders(origin) });
    } catch (error) {
        console.error('AI color palette error:', error);
        return NextResponse.json({ error: 'Failed to generate color palette' }, { status: 500 });
    }
}

function parseColorPaletteResponse(aiResponse: string, description: string, style: string, season: string) {
    // Extract hex codes from the response
    const hexMatches = aiResponse.match(/#[0-9A-Fa-f]{6}/g) || [];

    // Extract color names (look for capitalized color words)
    const colorNameMatches = aiResponse.match(/([A-Z][a-z]+\s+[A-Z][a-z]+|[A-Z][a-z]+)/g) || [];
    const colorNames = colorNameMatches.filter(name =>
        name.toLowerCase().includes('blue') ||
        name.toLowerCase().includes('red') ||
        name.toLowerCase().includes('green') ||
        name.toLowerCase().includes('yellow') ||
        name.toLowerCase().includes('purple') ||
        name.toLowerCase().includes('orange') ||
        name.toLowerCase().includes('pink') ||
        name.toLowerCase().includes('brown') ||
        name.toLowerCase().includes('gray') ||
        name.toLowerCase().includes('black') ||
        name.toLowerCase().includes('white') ||
        name.toLowerCase().includes('navy') ||
        name.toLowerCase().includes('cream') ||
        name.toLowerCase().includes('beige') ||
        name.toLowerCase().includes('sage') ||
        name.toLowerCase().includes('coral') ||
        name.toLowerCase().includes('teal') ||
        name.toLowerCase().includes('burgundy') ||
        name.toLowerCase().includes('ivory') ||
        name.toLowerCase().includes('charcoal')
    ).slice(0, 7);

    // Generate fallback colors if not enough were extracted
    const fallbackColors = generateFallbackPalette(style, season);

    // Combine extracted and fallback colors
    const colors = [];
    const maxColors = Math.min(7, Math.max(hexMatches.length, colorNames.length, 5));

    for (let i = 0; i < maxColors; i++) {
        colors.push({
            name: colorNames[i] || fallbackColors[i]?.name || `Color ${i + 1}`,
            hex: hexMatches[i] || fallbackColors[i]?.hex || generateRandomHex(),
            description: extractColorDescription(aiResponse, colorNames[i] || fallbackColors[i]?.name || '')
        });
    }

    // Extract styling suggestions
    const stylingSuggestions = extractStylingSuggestions(aiResponse);

    return {
        colors,
        description: `${style} color palette for ${description}`,
        style,
        season,
        stylingSuggestions,
        analysis: aiResponse
    };
}

function generateFallbackPalette(style: string, season: string) {
    const palettes = {
        modern: {
            'spring': [
                { name: 'Fresh Mint', hex: '#98FB98' },
                { name: 'Coral Pink', hex: '#FF7F7F' },
                { name: 'Sky Blue', hex: '#87CEEB' },
                { name: 'Warm Gray', hex: '#A0A0A0' },
                { name: 'Cream White', hex: '#F5F5DC' }
            ],
            'summer': [
                { name: 'Ocean Blue', hex: '#006994' },
                { name: 'Sunset Orange', hex: '#FF8C42' },
                { name: 'Sandy Beige', hex: '#F5E6D3' },
                { name: 'Sage Green', hex: '#9CAF88' },
                { name: 'Pure White', hex: '#FFFFFF' }
            ],
            'fall': [
                { name: 'Burnt Orange', hex: '#CC5500' },
                { name: 'Deep Burgundy', hex: '#800020' },
                { name: 'Golden Yellow', hex: '#FFD700' },
                { name: 'Forest Green', hex: '#355E3B' },
                { name: 'Warm Brown', hex: '#8B4513' }
            ],
            'winter': [
                { name: 'Deep Navy', hex: '#1A365D' },
                { name: 'Charcoal Gray', hex: '#36454F' },
                { name: 'Crimson Red', hex: '#DC143C' },
                { name: 'Ice Blue', hex: '#B0E0E6' },
                { name: 'Snow White', hex: '#FFFAFA' }
            ]
        }
    };

    const seasonKey = season === 'all-season' ? 'spring' : season;
    return palettes.modern[seasonKey as keyof typeof palettes.modern] || palettes.modern.spring;
}

function generateRandomHex(): string {
    return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
}

function extractColorDescription(text: string, colorName: string): string {
    if (!colorName) return 'A versatile color choice';

    const lines = text.split('\n');
    for (const line of lines) {
        if (line.toLowerCase().includes(colorName.toLowerCase()) && line.length > colorName.length + 10) {
            return line.trim();
        }
    }
    return `${colorName} adds depth and character to the palette`;
}

function extractStylingSuggestions(text: string): string[] {
    const suggestions: string[] = [];
    const lines = text.split('\n');

    for (const line of lines) {
        if (line.includes('style') || line.includes('wear') || line.includes('pair') || line.includes('combine')) {
            const cleaned = line.replace(/^\d+\.?\s*/, '').trim();
            if (cleaned.length > 15) {
                suggestions.push(cleaned);
            }
        }
    }

    return suggestions.length > 0 ? suggestions.slice(0, 5) : [
        'Use the darker colors as base pieces and lighter colors as accents',
        'Combine 2-3 colors maximum in a single outfit for best results',
        'Use neutral colors to balance bold accent colors',
        'Consider the occasion when selecting color combinations'
    ];
}

export async function OPTIONS(request: NextRequest) {
    const origin = request.headers.get('origin') || '*';
    return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}