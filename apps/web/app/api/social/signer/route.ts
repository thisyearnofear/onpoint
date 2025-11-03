import { NextResponse } from 'next/server';
import { NeynarSocialUtils } from '../../../../lib/utils/neynar';

export async function POST() {
  try {
    const signer = await NeynarSocialUtils.createManagedSigner();
    if (!signer) {
      return NextResponse.json({ error: 'Failed to create signer' }, { status: 500 });
    }
    return NextResponse.json({ signer });
  } catch (error) {
    console.error('Signer creation API error:', error);
    return NextResponse.json({ error: 'Failed to create signer' }, { status: 500 });
  }
}