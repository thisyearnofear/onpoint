import { NextRequest, NextResponse } from 'next/server';
import { generateText } from '../_utils/providers';
import { corsHeaders } from '../_utils/http';

export async function POST(request: NextRequest) {
    try {
        const { prompt, preferences, provider = 'auto', model } = await request.json();
        const origin = request.headers.get('origin') || '*';

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400, headers: corsHeaders(origin) });
        }

        // Enhanced prompt for style suggestions
        const enhancedPrompt = `${prompt}

${preferences ? `User preferences: ${JSON.stringify(preferences)}` : ''}

Please provide style suggestions in the following JSON format:
{
  "suggestions": [
    {
      "category": "tops|bottoms|outerwear|accessories|shoes|bags",
      "items": [
        {
          "name": "Item name",
          "description": "Detailed description",
          "reasoning": "Why this item works",
          "priority": "high|medium|low"
        }
      ]
    }
  ]
}

Focus on:
1. Versatile pieces that work for multiple occasions
2. Items that complement each other
3. Current fashion trends
4. Quality and value considerations
5. Seasonal appropriateness

Provide 3-5 categories with 2-3 items each.`;

        const modelChoice = model as ('pro' | 'flash' | 'flash-lite' | undefined);
        const { text, usedProvider } = await generateText({
            prompt: enhancedPrompt,
            provider,
            preferGemini: false,
            preferOpenAI: true,
            geminiModel: modelChoice ? (await import('../_utils/providers')).resolveGeminiModel(modelChoice) : 'gemini-2.5-flash',
            openaiModel: modelChoice ? (await import('../_utils/providers')).resolveOpenAIModel(modelChoice) : 'gpt-3.5-turbo',
            openaiOptions: { max_tokens: 1000, temperature: 0.7 },
        });

        // Try to parse JSON response, fallback to structured parsing
        let suggestions;
        try {
            const parsed = JSON.parse(text || '{}');
            suggestions = parsed.suggestions || [];
        } catch {
            // Fallback: parse text response into structured format
            suggestions = parseStyleSuggestionsFromText(text || '');
        }

        return NextResponse.json({
            suggestions,
            provider: provider === 'auto' ? usedProvider : provider
        }, { headers: corsHeaders(origin) });
    } catch (error) {
        console.error('AI style suggestions error:', error);
        return NextResponse.json({ error: 'Failed to generate style suggestions' }, { status: 500 });
    }
}

function parseStyleSuggestionsFromText(text: string) {
    const suggestions = [];
    const categories = ['tops', 'bottoms', 'outerwear', 'accessories', 'shoes', 'bags'];

    for (const category of categories) {
        const categoryRegex = new RegExp(`${category}[:\\s]*([\\s\\S]*?)(?=${categories.join('|')}|$)`, 'i');
        const match = text.match(categoryRegex);

        if (match && match[1]) {
            const items = [];
            const lines = match[1].split('\n').filter(line => line.trim());

            for (const line of lines.slice(0, 3)) { // Max 3 items per category
                if (line.trim() && !line.includes(':')) {
                    items.push({
                        name: line.trim().replace(/^\d+\.?\s*/, ''),
                        description: `Recommended ${category.slice(0, -1)} piece`,
                        reasoning: 'Based on current trends and versatility',
                        priority: 'high'
                    });
                }
            }

            if (items.length > 0) {
                suggestions.push({ category, items });
            }
        }
    }

    // Fallback suggestions if parsing fails
    if (suggestions.length === 0) {
        return [
            {
                category: 'tops',
                items: [
                    {
                        name: 'Classic White Button-Down',
                        description: 'Versatile foundation piece',
                        reasoning: 'Essential wardrobe staple',
                        priority: 'high'
                    }
                ]
            },
            {
                category: 'bottoms',
                items: [
                    {
                        name: 'Dark Wash Jeans',
                        description: 'Well-fitted denim',
                        reasoning: 'Universally flattering',
                        priority: 'high'
                    }
                ]
            }
        ];
    }

    return suggestions;
}

export async function OPTIONS(request: NextRequest) {
    const origin = request.headers.get('origin') || '*';
    return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}