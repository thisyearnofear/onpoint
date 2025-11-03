import { NextRequest, NextResponse } from 'next/server';
import { NeynarSocialUtils } from '../../../../lib/utils/neynar';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');
    const feedType = searchParams.get('feedType') || 'following';
    const limit = parseInt(searchParams.get('limit') || '25');

    if (!fid) {
      return NextResponse.json({ error: 'fid parameter required' }, { status: 400 });
    }

    let feed;
    if (feedType === 'trending') {
      feed = await NeynarSocialUtils.getTrendingCasts(limit);
    } else {
      feed = await NeynarSocialUtils.getUserFeed(parseInt(fid), limit);
    }

    if (!feed) {
      return NextResponse.json({ casts: [] });
    }

    // Transform Neynar feed format to our app's format
    const casts = feed.casts?.map((cast: any) => ({
      id: cast.hash,
      text: cast.text,
      author: {
        fid: cast.author.fid,
        username: cast.author.username,
        displayName: cast.author.display_name,
        pfpUrl: cast.author.pfp_url,
        verified: cast.author.power_badge || false,
      },
      timestamp: cast.timestamp,
      embeds: cast.embeds || [],
      reactions: {
        likes: cast.reactions?.likes_count || 0,
        recasts: cast.reactions?.recasts_count || 0,
      },
      threadHash: cast.thread_hash,
      parentHash: cast.parent_hash,
    })) || [];

    return NextResponse.json({ casts });
  } catch (error) {
    console.error('Social feed API error:', error);
    return NextResponse.json({ error: 'Failed to fetch feed' }, { status: 500 });
  }
}
