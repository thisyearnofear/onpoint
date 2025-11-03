import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // TODO: handle Farcaster/Neynar notification payloads
    console.log('Webhook received', body);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
  }
}