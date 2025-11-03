"use client";

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@repo/ui/card';
import { Button } from '@repo/ui/button';
import { Input } from '@repo/ui/input';
import { Badge } from '@repo/ui/badge';
import {
    Heart,
    MessageCircle,
    Share,
    Camera,
    Sparkles,
    Palette,
    Clock,
    TrendingUp,
    Search
} from 'lucide-react';
import { FarcasterUser } from './FarcasterUser';
import { useMemoryAPI, useSocialActivities } from '../lib/hooks/useMemoryAPI';
import { SocialActivity } from '@onpoint/shared-types';

interface SocialFeedProps {
    filter?: 'all' | 'following' | 'trending';
    showDiscovery?: boolean;
}

export function SocialFeed({ filter = 'all', showDiscovery = true }: SocialFeedProps) {
    const [activities, setActivities] = useState<SocialActivity[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
    const { recordReaction } = useSocialActivities();
    const { searchUsers } = useMemoryAPI();
    const searchParams = useSearchParams();

    // Fetch real social feed from Neynar API
    useEffect(() => {
        const fetchFeed = async () => {
            setIsLoading(true);
            try {
                const feedType = filter === 'trending' ? 'trending' : 'following';
                const fid = searchParams.get('fid') || '3'; // Default to some FID for demo

                const response = await fetch(`/api/social/feed?fid=${fid}&feedType=${feedType}&limit=25`);
                if (!response.ok) {
                    throw new Error('Failed to fetch feed');
                }

                const data = await response.json();

                // Transform Neynar casts to SocialActivity format
                const socialActivities: SocialActivity[] = data.casts.map((cast: any) => ({
                    id: cast.id,
                    userId: cast.author.fid.toString(),
                    type: 'cast', // Generic cast type
                    targetId: cast.id,
                    metadata: {
                        text: cast.text,
                        author: cast.author,
                        embeds: cast.embeds,
                        reactions: cast.reactions,
                    },
                    createdAt: new Date(cast.timestamp),
                }));

                setActivities(socialActivities);
            } catch (error) {
                console.error('Failed to fetch social feed:', error);
                // Fallback to empty array on error
                setActivities([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchFeed();
    }, [filter]);

    if (isLoading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                    <Card key={i}>
                        <CardContent className="p-6">
                            <div className="animate-pulse space-y-4">
                                <div className="flex items-center space-x-4">
                                    <div className="w-12 h-12 bg-muted rounded-full"></div>
                                    <div className="space-y-2 flex-1">
                                        <div className="h-4 bg-muted rounded w-3/4"></div>
                                        <div className="h-3 bg-muted rounded w-1/2"></div>
                                    </div>
                                </div>
                                <div className="h-32 bg-muted rounded"></div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    const platforms = [
        { id: 'all', name: 'All', icon: '🌐' },
        { id: 'farcaster', name: 'Farcaster', icon: '🟣' },
        { id: 'twitter', name: 'Twitter', icon: '🐦' },
        { id: 'github', name: 'GitHub', icon: '🐙' },
    ];

    const handleSearch = async () => {
        if (!searchQuery.trim() || selectedPlatform === 'all') return;

        try {
            await searchUsers.mutateAsync({
                platform: selectedPlatform,
                query: searchQuery,
            });
        } catch (error) {
            console.error('Search failed:', error);
        }
    };

    return (
        <div className="space-y-6">
            {/* Enhanced Feed Header with Discovery */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold">Social Feed</h2>
                    <div className="flex space-x-2">
                        <Button
                            variant={filter === 'all' ? 'default' : 'outline'}
                            size="sm"
                        >
                            All
                        </Button>
                        <Button
                            variant={filter === 'following' ? 'default' : 'outline'}
                            size="sm"
                        >
                            Following
                        </Button>
                        <Button
                            variant={filter === 'trending' ? 'default' : 'outline'}
                            size="sm"
                        >
                            <TrendingUp className="w-4 h-4 mr-1" />
                            Trending
                        </Button>
                    </div>
                </div>

                {/* Integrated Discovery */}
                {showDiscovery && (
                    <Card className="bg-muted/30">
                        <CardContent className="p-4">
                            <div className="flex items-center space-x-2 mb-3">
                                <Search className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm font-medium">Discover Creators</span>
                            </div>
                            <div className="flex flex-wrap gap-2 mb-3">
                                {platforms.map((platform) => (
                                    <Badge
                                        key={platform.id}
                                        variant={selectedPlatform === platform.id ? 'default' : 'outline'}
                                        className="cursor-pointer text-xs"
                                        onClick={() => setSelectedPlatform(platform.id)}
                                    >
                                        <span className="mr-1">{platform.icon}</span>
                                        {platform.name}
                                    </Badge>
                                ))}
                            </div>
                            <div className="flex space-x-2">
                                <Input
                                    placeholder="Search creators..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                    className="text-sm"
                                />
                                <Button
                                    onClick={handleSearch}
                                    disabled={!searchQuery.trim() || selectedPlatform === 'all'}
                                    size="sm"
                                >
                                    <Search className="w-4 h-4" />
                                </Button>
                            </div>
                            {searchUsers.data && searchUsers.data.length > 0 && (
                                <div className="mt-3 space-y-2">
                                    {searchUsers.data.slice(0, 3).map((identity: any) => (
                                        <FarcasterUser key={identity.id} fid={parseInt(identity.id)} compact />
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Activity Feed */}
            <div className="space-y-4">
                {activities.map((activity) => (
                    <SocialActivityCard
                        key={activity.id}
                        activity={activity}
                        onReaction={(reactionType) =>
                            recordReaction(activity.targetId, reactionType)
                        }
                    />
                ))}
            </div>

            {activities.length === 0 && (
                <Card>
                    <CardContent className="p-12 text-center">
                        <Sparkles className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <h3 className="text-lg font-medium mb-2">No activities yet</h3>
                        <p className="text-muted-foreground">
                            Start creating outfits and trying them on to see social activities here!
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

function SocialActivityCard({
    activity,
    onReaction
}: {
    activity: SocialActivity;
    onReaction: (reactionType: string) => void;
}) {
    const [reactions, setReactions] = useState({
        like: Math.floor(Math.random() * 20),
        fire: Math.floor(Math.random() * 15),
        star: Math.floor(Math.random() * 10),
    });

    const getActivityIcon = (type: SocialActivity['type']) => {
    switch (type) {
    case 'try_on': return <Camera className="w-5 h-5 text-blue-500" />;
    case 'mint': return <Sparkles className="w-5 h-5 text-purple-500" />;
    case 'reaction': return <Heart className="w-5 h-5 text-red-500" />;
    case 'share': return <Share className="w-5 h-5 text-green-500" />;
    case 'cast': return <MessageCircle className="w-5 h-5 text-blue-500" />;
        default: return <Palette className="w-5 h-5 text-gray-500" />;
        }
    };

    const getActivityText = (activity: SocialActivity) => {
    switch (activity.type) {
    case 'try_on':
        return `tried on ${activity.metadata?.outfitName || 'an outfit'}`;
    case 'mint':
        return `minted ${activity.metadata?.nftName || 'an NFT'}`;
    case 'reaction':
        return `reacted to ${activity.metadata?.targetName || 'an item'}`;
    case 'share':
        return `shared ${activity.metadata?.targetName || 'an item'}`;
    case 'cast':
            return 'posted on Farcaster';
            default:
                return 'did something cool';
        }
    };

    const formatTimeAgo = (date: Date) => {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    };

    const handleReaction = (reactionType: string) => {
        setReactions(prev => ({
            ...prev,
            [reactionType]: (prev[reactionType as keyof typeof prev] || 0) + 1,
        }));
        onReaction(reactionType);
    };

    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
                <div className="space-y-4">
                    {/* Activity Header */}
                    <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0">
                            {getActivityIcon(activity.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                                <FarcasterUser fid={parseInt(activity.userId)} compact />
                                <span className="text-muted-foreground">
                                    {getActivityText(activity)}
                                </span>
                            </div>
                            <div className="flex items-center space-x-1 mt-1 text-sm text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                <span>{formatTimeAgo(activity.createdAt)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Activity Content */}
                    {activity.type === 'try_on' && (
                    <div className="bg-muted/50 rounded-lg p-4">
                    <div className="aspect-video bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg flex items-center justify-center">
                    <Camera className="w-12 h-12 text-muted-foreground" />
                    </div>
                    <p className="mt-2 font-medium">{activity.metadata?.outfitName}</p>
                    </div>
                    )}

                    {activity.type === 'mint' && (
                    <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg p-4">
                    <div className="aspect-square bg-gradient-to-br from-purple-400 to-pink-400 rounded-lg flex items-center justify-center max-w-32">
                    <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <p className="mt-2 font-medium">{activity.metadata?.nftName}</p>
                    <p className="text-sm text-muted-foreground">NFT Collection</p>
                    </div>
                    )}

                    {activity.type === 'cast' && (
                        <div className="bg-muted/30 rounded-lg p-4">
                            <p className="text-sm leading-relaxed mb-3">{activity.metadata?.text}</p>
                            {activity.metadata?.embeds && activity.metadata.embeds.length > 0 && (
                                <div className="space-y-2">
                                    {activity.metadata.embeds.map((embed: any, index: number) => (
                                        <div key={index} className="bg-background rounded border p-2">
                                            {embed.url && (
                                                <img
                                                    src={embed.url}
                                                    alt="Cast embed"
                                                    className="max-w-full h-auto rounded max-h-48 object-cover"
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Reaction Bar */}
                    <div className="flex items-center justify-between pt-2 border-t">
                        <div className="flex space-x-4">
                            <ReactionButton
                                emoji="❤️"
                                count={reactions.like}
                                onClick={() => handleReaction('like')}
                            />
                            <ReactionButton
                                emoji="🔥"
                                count={reactions.fire}
                                onClick={() => handleReaction('fire')}
                            />
                            <ReactionButton
                                emoji="⭐"
                                count={reactions.star}
                                onClick={() => handleReaction('star')}
                            />
                        </div>
                        <div className="flex space-x-2">
                            <Button variant="ghost" size="sm">
                                <MessageCircle className="w-4 h-4 mr-1" />
                                Comment
                            </Button>
                            <Button variant="ghost" size="sm">
                                <Share className="w-4 h-4 mr-1" />
                                Share
                            </Button>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function ReactionButton({
    emoji,
    count,
    onClick
}: {
    emoji: string;
    count: number;
    onClick: () => void;
}) {
    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={onClick}
            className="flex items-center space-x-1 hover:bg-muted"
        >
            <span>{emoji}</span>
            <span className="text-sm">{count}</span>
        </Button>
    );
}