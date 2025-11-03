import { NextRequest, NextResponse } from 'next/server';
import { NeynarSocialUtils } from '../../../../../lib/utils/neynar';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ fid: string }> }
) {
    try {
        const resolvedParams = await params;
        const fid = parseInt(resolvedParams.fid);

        if (!fid) {
            return NextResponse.json({ error: 'Invalid fid' }, { status: 400 });
        }

        // Fetch user profile and social stats
        const [profile, socialStats] = await Promise.all([
            NeynarSocialUtils.getUserProfile(fid),
            NeynarSocialUtils.getUserSocialStats(fid),
        ]);

        if (!profile) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Transform Neynar data to our format
        const user = {
            fid: profile.fid,
            username: profile.username,
            displayName: profile.display_name,
            pfpUrl: profile.pfp_url,
            bio: profile.profile?.bio?.text || '',
            verified: profile.power_badge || false,
            followerCount: socialStats.followersCount,
            followingCount: socialStats.followingCount,
            followers: socialStats.followers,
            following: socialStats.following,
        };

        return NextResponse.json({ user });
    } catch (error) {
        console.error('User API error:', error);
        return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
    }
}
