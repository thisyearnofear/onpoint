import { NextRequest, NextResponse } from 'next/server';
import { corsHeaders } from '../_utils/http';
import { generateVision, resolveGeminiModel } from '../_utils/providers';

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, imageBase64, provider = 'auto', model = 'flash', prompt } = await request.json();
    const origin = request.headers.get('origin') || '*';

    if (!imageUrl && !imageBase64) {
      return NextResponse.json({ error: 'imageUrl or imageBase64 is required' }, { status: 400, headers: corsHeaders(origin) });
    }

    // Fetch and base64-encode if URL provided
    let base64 = imageBase64 as string | undefined;
    if (!base64 && imageUrl) {
      const res = await fetch(imageUrl);
      if (!res.ok) {
        return NextResponse.json({ error: `Failed to fetch image: ${res.status}` }, { status: 400, headers: corsHeaders(origin) });
      }
      const arrayBuf = await res.arrayBuffer();
      const bytes = Buffer.from(arrayBuf);
      base64 = bytes.toString('base64');
    }

    const enhancedPrompt = prompt || `Analyze this outfit image for style, fit, color coordination, and overall aesthetic. Provide:
1) Rating out of 10 with brief reasoning
2) 3 strengths
3) 2 improvements with actionable suggestions
4) One style note`;

    const { text, usedProvider } = await generateVision({
      prompt: enhancedPrompt,
      imageBase64: base64!,
      provider,
      modelChoice: model as 'pro' | 'flash' | 'flash-lite',
    });

    return NextResponse.json({
      result: text,
      provider: provider === 'auto' ? usedProvider : provider,
    }, { headers: corsHeaders(origin) });
  } catch (error) {
    console.error('AI image analysis error:', error);
    return NextResponse.json({ error: 'Failed to analyze image with AI' }, { status: 500 });
  }
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin') || '*';
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}