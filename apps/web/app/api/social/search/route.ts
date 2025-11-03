import { NextRequest, NextResponse } from 'next/server';
import { NeynarSocialUtils } from '../../../../lib/utils/neynar';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!query) {
      return NextResponse.json({ error: 'q parameter required' }, { status: 400 });
    }

    const result = await NeynarSocialUtils.searchUsers(query, limit);

    // Transform Neynar user format to our app's format
    const users = result.users?.map((user: any) => ({
      fid: user.fid,
      username: user.username,
      displayName: user.display_name,
      pfpUrl: user.pfp_url,
      verified: user.power_badge || false,
      followerCount: user.follower_count || 0,
      followingCount: user.following_count || 0,
      bio: user.profile?.bio?.text || '',
    })) || [];

    return NextResponse.json({ users });
  } catch (error) {
    console.error('User search API error:', error);
    return NextResponse.json({ error: 'Failed to search users' }, { status: 500 });
  }
}
