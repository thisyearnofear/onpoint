import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get('image');

    if (!image) {
      return NextResponse.json({ error: 'Image is required' }, { status: 400 });
    }

    const apiKey = process.env.NEYNAR_API_KEY || '';
    
    // Forward to Neynar for image hosting
    const neynarFormData = new FormData();
    neynarFormData.append('image', image);

    const neynarRes = await fetch('https://api.neynar.com/v2/farcaster/content/image', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
      },
      body: neynarFormData,
    });

    if (!neynarRes.ok) {
      const errorText = await neynarRes.text();
      console.error('Neynar upload failed:', errorText);
      throw new Error(`Neynar upload failed: ${neynarRes.status}`);
    }

    const data = await neynarRes.json();
    // Neynar returns { image: { url: '...' } }
    return NextResponse.json({ url: data.image?.url });
  } catch (error) {
    console.error('Upload API error:', error);
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
  }
}
