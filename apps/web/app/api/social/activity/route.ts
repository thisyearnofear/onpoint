import { NextRequest, NextResponse } from 'next/server';
import { SocialActivity } from '@onpoint/shared-types';

// This is a mock implementation - replace with your actual database
const activities: SocialActivity[] = [];

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const activity: SocialActivity = {
            id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            userId: body.userId,
            type: body.type,
            targetId: body.targetId,
            metadata: body.metadata || {},
            createdAt: new Date(),
        };

        // In a real implementation, save to database
        activities.push(activity);

        // Here you would also:
        // 1. Update user stats
        // 2. Trigger Memory Protocol rewards
        // 3. Update social feed
        // 4. Send notifications

        return NextResponse.json({
            success: true,
            activity,
            message: 'Social activity recorded successfully'
        });
    } catch (error) {
        console.error('Error recording social activity:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to record activity' },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const type = searchParams.get('type');
        const limit = parseInt(searchParams.get('limit') || '20');

        let filteredActivities = [...activities];

        if (userId) {
            filteredActivities = filteredActivities.filter(a => a.userId === userId);
        }

        if (type) {
            filteredActivities = filteredActivities.filter(a => a.type === type);
        }

        // Sort by most recent
        filteredActivities.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        // Limit results
        filteredActivities = filteredActivities.slice(0, limit);

        return NextResponse.json({
            success: true,
            activities: filteredActivities,
            total: filteredActivities.length
        });
    } catch (error) {
        console.error('Error fetching social activities:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch activities' },
            { status: 500 }
        );
    }
}