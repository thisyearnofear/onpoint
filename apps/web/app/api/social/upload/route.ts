import { NextRequest, NextResponse } from 'next/server';
import { uploadToIPFS } from '@repo/ipfs-client';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get('image') as File;

    if (!image) {
      return NextResponse.json({ error: 'Image is required' }, { status: 400 });
    }

    // 1. Upload to Lighthouse (Decentralized Storage)
    // Convert File to Buffer for the IPFS client
    const arrayBuffer = await image.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    let ipfsData = null;
    try {
      ipfsData = await uploadToIPFS(buffer, image.name);
      console.log('Lighthouse upload success:', ipfsData.cid);
    } catch (err) {
      console.error('Lighthouse upload failed, continuing with Neynar only:', err);
    }

    const apiKey = process.env.NEYNAR_API_KEY || '';
    
    // 2. Forward to Neynar for social hosting
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
    
    // Return both URLs
    return NextResponse.json({ 
      url: data.image?.url, 
      ipfsUrl: ipfsData?.url,
      ipfsCid: ipfsData?.cid 
    });
  } catch (error) {
    console.error('Upload API error:', error);
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
  }
}
