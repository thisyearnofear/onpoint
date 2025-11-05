import { NextRequest, NextResponse } from 'next/server';
import { generateText } from '../_utils/providers';
import { corsHeaders } from '../_utils/http';

export async function POST(request: NextRequest) {
    try {
        const { type, data, provider = 'auto', model } = await request.json();
        const origin = request.headers.get('origin') || '*';

        console.log('Virtual try-on request:', { type, hasPhotoData: !!data.photoData, hasPersonDescription: !!data.personDescription, itemCount: data.items?.length });

        if (!type) {
            return NextResponse.json({ error: 'Analysis type is required' }, { status: 400, headers: corsHeaders(origin) });
        }

        let result: string | undefined;
        let enhancedPrompt: string;

        if (type === 'body-analysis') {
            // For body analysis from photo description or measurements
            enhancedPrompt = `As a fashion fit specialist, analyze this body profile: "${data.description || 'Standard body measurements'}".

Provide CONCISE analysis including:
1. Body type classification (one word: pear, apple, hourglass, rectangle, inverted triangle)
2. Measurements for shoulders, chest, waist, hips (only: small, medium, large)
3. 3-4 key fit recommendations for common garments
4. 2-3 essential styling tips

Keep it practical and focused on measurements and fit. No generic advice.`;
        } else if (type === 'outfit-fit') {
            // For analyzing how specific outfits would fit
            enhancedPrompt = `As a fashion stylist, analyze how these outfit items would work together: "${data.items?.map((item: { name: string; description?: string; type?: string }) => `${item.name}: ${item.description || item.type || ''}`).join(', ')}".

Consider:
1. How the pieces complement each other in terms of fit and silhouette
2. Color coordination and visual harmony
3. Occasion appropriateness and styling versatility
4. Potential fit issues or styling challenges
5. Specific recommendations for improvement or alternatives

Provide actionable styling advice.`;
        } else if (type === 'enhancement') {
            // For enhancing virtual try-on experience
            enhancedPrompt = `As a virtual styling consultant, enhance this outfit combination: "${data.items?.map((item: { name: string; description?: string }) => `${item.name}: ${item.description || ''}`).join(', ')}".

Provide:
1. Enhanced styling suggestions to elevate the look
2. Accessory recommendations that would complete the outfit
3. Alternative pieces that could be substituted
4. Styling tips for different occasions or seasons
5. Color and texture combinations that would work well

Focus on practical, achievable improvements.`;
        } else {
            // Default case
            enhancedPrompt = `As a fashion consultant, provide analysis for: ${type}`;
        }

        if (type === 'generate-outfit-image') {
            // Handle image generation with Venice
            const veniceApiKey = process.env.VENICE_API_KEY;
            if (!veniceApiKey) {
                return NextResponse.json({ error: 'Venice API key not configured' }, { status: 500, headers: corsHeaders(origin) });
            }

            // Use the provided person description (analyzed in step 1)
            const personDescription = data.personDescription || '';

            // Create personalized prompt using the analysis
            const outfitDescription = data.items?.map((item: { name: string; description?: string }) => `${item.name}: ${item.description || ''}`).join(', ');

            // Check if person description is too long for Venice API (1500 char limit)
            let truncatedPersonDescription = personDescription;
            const basePromptLength = `Create a high-quality fashion photograph. They are wearing: ${outfitDescription}. The image should be a full-body portrait, professional fashion photography style, clean background, realistic lighting, detailed textures, modern fashion aesthetic. Create an attractive fashion model that would wear this outfit well.`.length;
            const availableLength = 1500 - basePromptLength;

            if (personDescription.length > availableLength) {
                truncatedPersonDescription = personDescription.substring(0, availableLength - 3) + '...';
                console.log(`Person description truncated from ${personDescription.length} to ${truncatedPersonDescription.length} characters`);
            }

            const enhancedPrompt = `Create a high-quality fashion photograph. ${truncatedPersonDescription ? `The person should match this description: ${truncatedPersonDescription}. ` : ''}They are wearing: ${outfitDescription}. The image should be a full-body portrait, professional fashion photography style, clean background, realistic lighting, detailed textures, modern fashion aesthetic. ${truncatedPersonDescription ? 'Make sure the person\'s appearance matches the description provided.' : 'Create an attractive fashion model that would wear this outfit well.'}`;

            const response = await fetch("https://api.venice.ai/api/v1/image/generate", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${veniceApiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: "venice-sd35",
                    prompt: enhancedPrompt,
                    width: 512,
                    height: 768, // Portrait aspect for fashion
                    format: "webp",
                    cfg_scale: 7,
                    steps: 20,
                }),
            });

            console.log('Venice API response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Venice API error response:', errorText);
                throw new Error(`Venice API error: ${response.status} ${response.statusText}`);
            }

            const veniceData = await response.json();
            console.log('Venice API response data keys:', Object.keys(veniceData));

            if (!veniceData.images || veniceData.images.length === 0) {
                console.error('No images in Venice response:', veniceData);
                throw new Error("No image generated");
            }

            console.log('Successfully generated image from Venice');

            // Generate personalized styling tips based on the person's analysis
            let personalizedTips: string[] = [];
            if (personDescription) {
                try {
                    console.log('Generating personalized styling tips...');
                    const stylingTipsPrompt = `Based on this person's appearance: "${personDescription}"

And considering they are wearing: ${outfitDescription}

Provide 4 specific, personalized styling tips that would complement their body type, features, and the outfit. Make the tips practical and tailored to their specific characteristics. Focus on:
- How the outfit flatters their body shape
- Colors that work with their skin tone/ethnicity
- Accessories or styling choices that enhance their features
- Any adjustments needed for their specific measurements

Keep each tip concise but specific to their appearance.`;

                    console.log('Calling generateText for styling tips...');
                    const tipsResponse = await generateText({
                        prompt: stylingTipsPrompt,
                        provider,
                        preferGemini: false,
                        preferOpenAI: true,
                        geminiModel: 'gemini-2.5-flash',
                        openaiModel: 'gpt-3.5-turbo',
                        openaiOptions: { max_tokens: 400, temperature: 0.7 },
                    });

                    console.log('Tips response received, text length:', tipsResponse.text?.length || 0);
                    personalizedTips = extractStylingTips(tipsResponse.text || '');
                    console.log('Generated personalized tips:', personalizedTips);
                } catch (tipsError) {
                    console.error('Styling tips generation error:', tipsError);
                    personalizedTips = [];
                }
            }

            // Fallback to generic tips if personalization failed
            if (personalizedTips.length === 0) {
                personalizedTips = [
                    'Layer pieces to add depth and dimension to your outfit',
                    'Choose accessories that complement your personal style',
                    'Ensure proper fit for comfort and confidence',
                    'Consider the color harmony of your complete look'
                ];
            }

            return NextResponse.json({
                generatedImage: veniceData.images[0],
                enhancedOutfit: data.items || [],
                stylingTips: personalizedTips,
                type
            }, { headers: corsHeaders(origin) });
        }

        const modelChoice = model as ('pro' | 'flash' | 'flash-lite' | undefined);
        const { text, usedProvider } = await generateText({
            prompt: enhancedPrompt,
            provider,
            preferGemini: false,
            preferOpenAI: true,
            geminiModel: modelChoice ? (await import('../_utils/providers')).resolveGeminiModel(modelChoice) : 'gemini-2.5-flash',
            openaiModel: modelChoice ? (await import('../_utils/providers')).resolveOpenAIModel(modelChoice) : 'gpt-3.5-turbo',
            openaiOptions: { max_tokens: 800, temperature: 0.7 },
        });
        result = text;

        // Parse the response based on type
        const analysisData = parseVirtualTryOnResponse(result || '', type, data);

        return NextResponse.json({
            ...analysisData,
            provider: provider === 'auto' ? usedProvider : provider,
            type
        }, { headers: corsHeaders(origin) });
    } catch (error) {
        console.error('AI virtual try-on error:', error);
        return NextResponse.json({ error: 'Failed to analyze virtual try-on' }, { status: 500 });
    }
}

function parseVirtualTryOnResponse(aiResponse: string, type: string, originalData: { items?: Array<{ name: string; description?: string }> }) {

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

    if (match && match[1]) {
        const measurementValue = match[1];
        const found = sizeWords.find(size => measurementValue.toLowerCase().includes(size));
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

    return recommendations.length > 0 ? recommendations.slice(0, 4) : [];
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

    return adjustments.length > 0 ? adjustments.slice(0, 3) : [];
}

function extractStylingTips(text: string): string[] {
    const tips: string[] = [];
    const lines = text.split('\n');

    for (const line of lines) {
        // Look for lines that start with numbers, bullets, or contain styling-related keywords
        const isTipLine = /^\d+\./.test(line) ||  // Numbered list
            /^[-•*]/.test(line) ||   // Bullet points
            /\b(tip|style|wear|pair|color|accessory|fit|flatter|enhance|complement)\b/i.test(line);

        if (isTipLine) {
            const cleaned = line.replace(/^\d+\.?\s*/, '').replace(/^[-•*]\s*/, '').trim();
            if (cleaned.length > 10 && cleaned.length < 200) {
                tips.push(cleaned);
            }
        }
    }

    // If no tips found, try to extract any reasonable sentences
    if (tips.length === 0) {
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20 && s.trim().length < 150);
        tips.push(...sentences.slice(0, 4));
    }

    return tips.length > 0 ? tips.slice(0, 4) : [
        'Layer pieces to add depth and dimension to your outfit',
        'Choose accessories that complement your personal style',
        'Ensure proper fit for comfort and confidence',
        'Consider the color harmony of your complete look'
    ];
}

function extractOutfitRecommendations(text: string): Array<{ item: string; reason: string; priority: number }> {
    const recommendations: Array<{ item: string; reason: string; priority: number }> = [];

    const lines = text.split('\n');
    for (let i = 0; i < lines.length && recommendations.length < 5; i++) {
        const line = lines[i];
        if (line && (line.includes('recommend') || line.includes('suggest') || line.includes('add') || line.includes('try'))) {
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

export async function OPTIONS(request: NextRequest) {
    const origin = request.headers.get('origin') || '*';
    return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}