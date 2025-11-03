import { NextResponse } from 'next/server';

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_URL || '';
  const webhookUrl = `${baseUrl}/api/webhook`;

  const manifest = {
    miniapp: {
      version: '1',
      name: 'BeOnPoint',
      iconUrl: `${baseUrl}/assets/1Product.png`,
      homeUrl: baseUrl || `${baseUrl}/`,
      imageUrl: `${baseUrl}/assets/1Product.png`,
      buttonTitle: 'Start BeOnPoint',
      splashImageUrl: `${baseUrl}/assets/1Product.png`,
      splashBackgroundColor: '#0F0F13',
      webhookUrl,
    },
    // Fill this using the Manifest Tool after deploying to production domain
    accountAssociation: null,
  };

  return NextResponse.json(manifest, { status: 200 });
}