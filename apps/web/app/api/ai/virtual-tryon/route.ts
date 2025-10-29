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
        const { type, data, provider = 'auto' } = await request.json();

        if (!type) {
            return NextResponse.json({ error: 'Analysis type is required' }, { status: 400 });
        }

        let result;
        let enhancedPrompt;

        if (type === 'body-analysis') {
            // For body analysis from photo description or measurements
            enhancedPrompt = `As a fashion fit specialist, analyze this body profile: "${data.description || 'Standard body measurements'}".

Provide detailed analysis including:
1. Body type classification (pear, apple, hourglass, rectangle, inverted triangle)
2. Estimated measurements for shoulders, chest, waist, and hips (in general terms like small, medium, large)
3. 5-7 specific fit recommendations for different garment types
4. 3-5 style adjustments that would be most flattering
5. Considerations for proportion balancing

Be specific and practical in your recommendations.`;
        } else if (type === 'outfit-fit') {
            // For analyzing how specific outfits would fit
            enhancedPrompt = `As a fashion stylist, analyze how these outfit items would work together: "${data.items?.map((item: any) => `${item.name}: ${item.description || item.type}`).join(', ')}".

Consider:
1. How the pieces complement each other in terms of fit and silhouette
2. Color coordination and visual harmony
3. Occasion appropriateness and styling versatility
4. Potential fit issues or styling challenges
5. Specific recommendations for improvement or alternatives

Provide actionable styling advice.`;
        } else if (type === 'enhancement') {
            // For enhancing virtual try-on experience
            enhancedPrompt = `As a virtual styling consultant, enhance this outfit combination: "${data.items?.map((item: any) => `${item.name}: ${item.description}`).join(', ')}".

Provide:
1. Enhanced styling suggestions to elevate the look
2. Accessory recommendations that would complete the outfit
3. Alternative pieces that could be substituted
4. Styling tips for different occasions or seasons
5. Color and texture combinations that would work well

Focus on practical, achievable improvements.`;
        }

        // Use OpenAI for analytical tasks (preferred for fit analysis)
        if (provider === 'openai' || (provider === 'auto' && openai)) {
            if (!openai) {
                return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
            }

            const response = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: enhancedPrompt }],
                max_tokens: 800,
                temperature: 0.7,
            });
            result = response.choices[0]?.message?.content;
        } else if (provider === 'gemini' && gemini) {
            if (!gemini) {
                return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
            }

            const model = gemini.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
            const response = await model.generateContent(enhancedPrompt);
            result = response.response.text();
        } else {
            return NextResponse.json({
                error: 'No AI provider available. Please configure GEMINI_API_KEY or OPENAI_API_KEY in your environment variables.'
            }, { status: 500 });
        }

        // Parse the response based on type
        const analysisData = parseVirtualTryOnResponse(result, type, data);

        return NextResponse.json({
            ...analysisData,
            provider: provider === 'auto' ? (openai ? 'openai' : 'gemini') : provider,
            type
        });
    } catch (error) {
        console.error('AI virtual try-on error:', error);
        return NextResponse.json({ error: 'Failed to analyze virtual try-on' }, { status: 500 });
    }
}

function parseVirtualTryOnResponse(aiResponse: string, type: string, originalData: any) {
    const lines = aiResponse.split('\n').filter(line => line.trim());

    if (type === 'body-analysis') {
        // Extract body type
        const bodyTypeMatch = aiResponse.match(/body type[:\s]*(\w+)/i);
        const bodyType = bodyTypeMatch ? bodyTypeMatch[1] : 'average';

        // Extract measurements
        const measurements = {
            shoulders: extractMeasurement(aiResponse, 'shoulders') || 'medium',
            chest: extractMeasurement(aiResponse, 'chest') || 'medium',
            waist: extractMeasurement(aiResponse, 'waist') || 'medium',
            hips: extractMeasurement(aiResponse, 'hips') || 'medium'
        };

        // Extract recommendations
        const fitRecommendations = extractRecommendations(aiResponse);
        const styleAdjustments = extractStyleAdjustments(aiResponse);

        return {
            bodyType,
            measurements,
            fitRecommendations,
            styleAdjustments,
            analysis: aiResponse
        };
    } else if (type === 'outfit-fit' || type === 'enhancement') {
        // Extract styling tips and recommendations
        const stylingTips = extractStylingTips(aiResponse);
        const recommendations = extractOutfitRecommendations(aiResponse);

        return {
            stylingTips,
            recommendations,
            analysis: aiResponse,
            enhancedOutfit: originalData.items || []
        };
    }

    return { analysis: aiResponse };
}

function extractMeasurement(text: string, bodyPart: string): string | null {
    const sizeWords = ['small', 'medium', 'large', 'extra small', 'extra large'];
    const regex = new RegExp(`${bodyPart}[:\\s]*([^\\n]*?)(?=\\n|$)`, 'i');
    const match = text.match(regex);

    if (match) {
        const found = sizeWords.find(size => match[1].toLowerCase().includes(size));
        return found || 'medium';
    }
    return null;
}

function extractRecommendations(text: string): string[] {
    const recommendations: string[] = [];
    const lines = text.split('\n');

    for (const line of lines) {
        if (line.includes('recommend') || line.includes('suggest') || line.includes('try') || line.includes('consider')) {
            const cleaned = line.replace(/^\d+\.?\s*/, '').trim();
            if (cleaned.length > 10) {
                recommendations.push(cleaned);
            }
        }
    }

    return recommendations.length > 0 ? recommendations.slice(0, 7) : [
        'Consider tailored fits for a polished look',
        'Pay attention to proportions when mixing oversized and fitted pieces',
        'Choose colors that complement your skin tone',
        'Invest in well-fitting undergarments as a foundation',
        'Consider the occasion when selecting outfit formality'
    ];
}

function extractStyleAdjustments(text: string): string[] {
    const adjustments: string[] = [];
    const lines = text.split('\n');

    for (const line of lines) {
        if (line.includes('adjust') || line.includes('balance') || line.includes('enhance') || line.includes('flatter')) {
            const cleaned = line.replace(/^\d+\.?\s*/, '').trim();
            if (cleaned.length > 10) {
                adjustments.push(cleaned);
            }
        }
    }

    return adjustments.length > 0 ? adjustments.slice(0, 5) : [
        'Adjust hem lengths for optimal proportions',
        'Consider belt placement to define waist',
        'Balance volume between top and bottom pieces',
        'Use layering to create visual interest'
    ];
}

function extractStylingTips(text: string): string[] {
    const tips: string[] = [];
    const lines = text.split('\n');

    for (const line of lines) {
        if (line.includes('tip') || line.includes('style') || line.includes('wear') || line.includes('pair')) {
            const cleaned = line.replace(/^\d+\.?\s*/, '').trim();
            if (cleaned.length > 10) {
                tips.push(cleaned);
            }
        }
    }

    return tips.length > 0 ? tips.slice(0, 5) : [
        'Mix textures for visual interest',
        'Balance proportions between top and bottom',
        'Add accessories to complete the look',
        'Consider the occasion when styling'
    ];
}

function extractOutfitRecommendations(text: string): Array<{ item: string; reason: string; priority: number }> {
    const recommendations: Array<{ item: string; reason: string; priority: number }> = [];
    const lines = text.split('\n');

    for (let i = 0; i < lines.length && recommendations.length < 5; i++) {
        const line = lines[i];
        if (line.includes('recommend') || line.includes('suggest') || line.includes('add') || line.includes('try')) {
            const cleaned = line.replace(/^\d+\.?\s*/, '').trim();
            if (cleaned.length > 10) {
                recommendations.push({
                    item: cleaned,
                    reason: 'Based on style analysis',
                    priority: recommendations.length + 1
                });
            }
        }
    }

    return recommendations.length > 0 ? recommendations : [
        { item: 'Consider color coordination', reason: 'Enhances overall look', priority: 1 },
        { item: 'Add complementary accessories', reason: 'Completes the outfit', priority: 2 },
        { item: 'Pay attention to fit and proportions', reason: 'Ensures flattering silhouette', priority: 3 }
    ];
}