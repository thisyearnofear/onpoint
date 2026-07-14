import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const slug = new URL(request.url).searchParams.get("slug");
  if (!slug || !/^[a-z0-9-]{2,64}$/.test(slug)) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  const hetzner = (
    process.env.AGENT_API_URL || "http://localhost:48751"
  ).replace(/\/$/, "");
  const serviceKey = process.env.SERVICE_API_KEY;

  try {
    const res = await fetch(
      `${hetzner}/api/curator/analytics?curatorSlug=${encodeURIComponent(slug)}`,
      {
        headers: {
          ...(serviceKey ? { "x-service-key": serviceKey } : {}),
        },
        signal: AbortSignal.timeout(10000),
      },
    );

    if (!res.ok) {
      return NextResponse.json(
        { pageViews: 0, tryOns: 0, shares: 0, buyClicks: 0 },
      );
    }

    const data = await res.json();
    const report = data.report || {};

    return NextResponse.json({
      pageViews: report.pageViews || 0,
      tryOns: report.tryOns || 0,
      shares: report.shares || 0,
      buyClicks: report.buyClicks || 0,
    });
  } catch {
    return NextResponse.json(
      { pageViews: 0, tryOns: 0, shares: 0, buyClicks: 0 },
    );
  }
}
