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
        const { prompt, type = 'design', provider = 'auto' } = await request.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Design prompt is required' }, { status: 400 });
        }

        let result;
        let enhancedPrompt;

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
        }

        // Use Gemini for creative design tasks (preferred for fashion creativity)
        if (provider === 'gemini' || (provider === 'auto' && gemini)) {
            if (!gemini) {
                return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
            }

            const model = gemini.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
            const response = await model.generateContent(enhancedPrompt);
            result = response.response.text();
        } else if (provider === 'openai' || (provider === 'auto' && openai)) {
            if (!openai) {
                return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
            }

            const response = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: enhancedPrompt }],
                max_tokens: 1000,
                temperature: 0.8, // Higher creativity for design tasks
            });
            result = response.choices[0]?.message?.content;
        } else {
            return NextResponse.json({
                error: 'No AI provider available. Please configure GEMINI_API_KEY or OPENAI_API_KEY in your environment variables.'
            }, { status: 500 });
        }

        // Parse the response to extract structured data
        const designData = parseDesignResponse(result, prompt);

        return NextResponse.json({
            ...designData,
            provider: provider === 'auto' ? (gemini ? 'gemini' : 'openai') : provider,
            type
        });
    } catch (error) {
        console.error('AI design error:', error);
        return NextResponse.json({ error: 'Failed to generate design' }, { status: 500 });
    }
}

function parseDesignResponse(aiResponse: string, originalPrompt: string) {
    // Extract structured data from AI response
    const lines = aiResponse.split('\n').filter(line => line.trim());

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