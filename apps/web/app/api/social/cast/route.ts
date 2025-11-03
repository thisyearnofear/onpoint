import { NextRequest, NextResponse } from 'next/server';
import { NeynarSocialUtils } from '../../../../lib/utils/neynar';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { signerUuid, text, embeds, parent } = body;

    if (!signerUuid || !text) {
      return NextResponse.json({ error: 'signerUuid and text are required' }, { status: 400 });
    }

    const cast = await NeynarSocialUtils.publishCast(signerUuid, {
      text,
      embeds: embeds?.map((url: string) => ({ url })),
      parent,
    });

    return NextResponse.json({ cast });
  } catch (error) {
    console.error('Cast publish API error:', error);
    return NextResponse.json({ error: 'Failed to publish cast' }, { status: 500 });
  }
}
