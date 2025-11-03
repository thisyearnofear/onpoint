import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const raw = await req.arrayBuffer();
    const bodyText = Buffer.from(raw).toString('utf8');
    const signatureHeader = (req as any).headers?.get?.('x-neynar-signature') || '';
    const secret = process.env.NEYNAR_WEBHOOK_SECRET;

    if (secret) {
      const hmac = crypto.createHmac('sha256', secret).update(bodyText).digest('hex');
      if (!signatureHeader || signatureHeader !== hmac) {
        return NextResponse.json({ ok: false, error: 'Invalid signature' }, { status: 401 });
      }
    }

    const body = JSON.parse(bodyText);
    // Basic routing by event type if provided
    const eventType = body?.type || body?.event || 'unknown';
    console.log('Webhook received', { eventType, payloadSize: bodyText.length });

    // TODO: persist events to storage and surface in UI

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
  }
}