import { NextRequest, NextResponse } from 'next/server';
import { uploadToIPFS } from '@repo/ipfs-client';

export async function POST(request: NextRequest) {
  try {
    const { data, name } = await request.json();

    if (!data) {
      return NextResponse.json({ error: 'Data is required' }, { status: 400 });
    }

    // data can be a string (JSON)
    const result = await uploadToIPFS(data, name || 'onpoint-data.json');
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('IPFS Upload API error:', error);
    return NextResponse.json({ error: 'Failed to upload to IPFS' }, { status: 500 });
  }
}
