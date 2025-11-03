"use client";

import { Avatar, AvatarFallback, AvatarImage } from '@repo/ui/avatar';
import { Badge } from '@repo/ui/badge';
import { Verified } from 'lucide-react';
import { useMiniApp } from '@neynar/react';

interface FarcasterUserProps {
    fid?: number;
    compact?: boolean;
}

export function FarcasterUser({ fid, compact = false }: FarcasterUserProps) {
    const { context } = useMiniApp();

    // Use provided fid or current user's fid
    const userFid = fid || context?.user?.fid;
    const user = context?.user;

    if (!userFid || !user) {
        return compact ? (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <div className="w-6 h-6 bg-muted rounded-full" />
                <span>Anonymous</span>
            </div>
        ) : null;
    }

    if (compact) {
        return (
            <div className="flex items-center space-x-2">
                <Avatar className="w-6 h-6">
                    <AvatarImage src={user.pfpUrl} />
                    <AvatarFallback className="text-xs">
                        {user.displayName?.[0]?.toUpperCase() || user.username?.[0]?.toUpperCase() || '?'}
                    </AvatarFallback>
                </Avatar>
                <div className="flex items-center space-x-1">
                    <span className="text-sm font-medium">
                        {user.displayName || user.username || `User ${userFid}`}
                    </span>
                    {user.verifications?.length > 0 && (
                        <Verified className="w-3 h-3 text-blue-500" />
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center space-x-3 p-4 bg-card rounded-lg border">
            <Avatar className="w-12 h-12">
                <AvatarImage src={user.pfpUrl} />
                <AvatarFallback>
                    {user.displayName?.[0]?.toUpperCase() || user.username?.[0]?.toUpperCase() || '?'}
                </AvatarFallback>
            </Avatar>
            <div className="flex-1">
                <div className="flex items-center space-x-2">
                    <h3 className="font-semibold">
                        {user.displayName || user.username || `User ${userFid}`}
                    </h3>
                    {user.verifications?.length > 0 && (
                        <Verified className="w-4 h-4 text-blue-500" />
                    )}
                </div>
                <p className="text-sm text-muted-foreground">@{user.username}</p>
                <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                    <span>{user.followerCount || 0} followers</span>
                    <span>{user.followingCount || 0} following</span>
                </div>
                <Badge variant="secondary" className="mt-2">
                    <span className="mr-1">🟣</span>
                    Farcaster
                </Badge>
            </div>
        </div>
    );
}