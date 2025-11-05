import { NextRequest, NextResponse } from 'next/server';
import { corsHeaders } from '../_utils/http';

export async function POST(request: NextRequest) {
    try {
        const { photoData } = await request.json();
        const origin = request.headers.get('origin') || '*';

        if (!photoData) {
            return NextResponse.json({ error: 'Photo data is required' }, { status: 400, headers: corsHeaders(origin) });
        }

        const veniceApiKey = process.env.VENICE_API_KEY;
        if (!veniceApiKey) {
            return NextResponse.json({ error: 'Venice API key not configured' }, { status: 500, headers: corsHeaders(origin) });
        }

        console.log('Analyzing person appearance...');

        const visionResponse = await fetch("https://api.venice.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${veniceApiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "mistral-31-24b",
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: "Analyze this person's physical appearance in detail. Describe their: gender, age range, ethnicity, body type/shape, height (tall/average/short), build (slim/athletic/average/full), skin tone, hair style and color, eye color if visible, facial features, and any distinctive characteristics. Provide a comprehensive but concise description that would help create a personalized fashion image that looks exactly like this person. Be specific and factual."
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: photoData
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 250
            })
        });

        if (!visionResponse.ok) {
            const errorText = await visionResponse.text();
            console.error('Vision analysis failed:', visionResponse.status, errorText);
            return NextResponse.json({ error: 'Failed to analyze person' }, { status: 500, headers: corsHeaders(origin) });
        }

        const visionData = await visionResponse.json();
        const description = visionData.choices?.[0]?.message?.content || '';

        console.log('Person analysis complete:', description.substring(0, 100) + '...');

        return NextResponse.json({
            description: description.trim(),
        }, { headers: corsHeaders(origin) });

    } catch (error) {
        console.error('Person analysis error:', error);
        return NextResponse.json({ error: 'Failed to analyze person' }, { status: 500 });
    }
}

export async function OPTIONS(request: NextRequest) {
    const origin = request.headers.get('origin') || '*';
    return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}
