import { NextRequest, NextResponse } from 'next/server';
import { NeynarSocialUtils } from '../../../../lib/utils/neynar';

export async function POST(request: NextRequest) {
  try {
    const { signerUuid, castHash, reaction } = await request.json();
    if (!signerUuid || !castHash || !reaction) {
      return NextResponse.json({ error: 'signerUuid, castHash and reaction are required' }, { status: 400 });
    }
    const result = await NeynarSocialUtils.reactToCast(signerUuid, castHash, reaction);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error('Reaction API error:', error);
    return NextResponse.json({ error: 'Failed to publish reaction' }, { status: 500 });
  }
}