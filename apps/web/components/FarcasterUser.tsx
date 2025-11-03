"use client";

import { Avatar, AvatarFallback, AvatarImage } from '@repo/ui/avatar';
import { Badge } from '@repo/ui/badge';
import { Verified } from 'lucide-react';
import { useMiniApp } from '@neynar/react';
import { useState, useEffect } from 'react';

interface FarcasterUserProps {
    fid?: number;
    compact?: boolean;
}

export function FarcasterUser({ fid, compact = false }: FarcasterUserProps) {
    const { context } = useMiniApp();
    const [userData, setUserData] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    // Use provided fid or current user's fid
    const userFid = fid || context?.user?.fid;
    const user = context?.user;

    // Fetch additional user data from Neynar
    useEffect(() => {
        const fetchUserData = async () => {
            if (!userFid) return;

            setLoading(true);
            try {
                const response = await fetch(`/api/social/user/${userFid}`);
                if (response.ok) {
                    const data = await response.json();
                    setUserData(data.user);
                }
            } catch (error) {
                console.error('Failed to fetch user data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, [userFid]);

    // Merge context user with Neynar data
    const displayUser = userData || user;

    if (!userFid || !displayUser) {
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
                    <AvatarImage src={displayUser.pfpUrl} />
                    <AvatarFallback className="text-xs">
                        {displayUser.displayName?.[0]?.toUpperCase() || displayUser.username?.[0]?.toUpperCase() || '?'}
                    </AvatarFallback>
                </Avatar>
                <div className="flex items-center space-x-1">
                    <span className="text-sm font-medium">
                        {displayUser.displayName || displayUser.username || `User ${userFid}`}
                    </span>
                    {displayUser.verified && (
                        <Verified className="w-3 h-3 text-blue-500" />
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center space-x-3 p-4 bg-card rounded-lg border">
            <Avatar className="w-12 h-12">
                <AvatarImage src={displayUser.pfpUrl} />
                <AvatarFallback>
                    {displayUser.displayName?.[0]?.toUpperCase() || displayUser.username?.[0]?.toUpperCase() || '?'}
                </AvatarFallback>
            </Avatar>
            <div className="flex-1">
                <div className="flex items-center space-x-2">
                    <h3 className="font-semibold">
                        {displayUser.displayName || displayUser.username || `User ${userFid}`}
                    </h3>
                    {displayUser.verified && (
                        <Verified className="w-4 h-4 text-blue-500" />
                    )}
                </div>
                <p className="text-sm text-muted-foreground">@{displayUser.username}</p>
                <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                    <span>{displayUser.followerCount || 0} followers</span>
                    <span>{displayUser.followingCount || 0} following</span>
                </div>
                <Badge variant="secondary" className="mt-2">
                    <span className="mr-1">🟣</span>
                    Farcaster
                </Badge>
            </div>
        </div>
    );
}