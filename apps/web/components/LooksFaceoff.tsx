"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent } from "@repo/ui/card";
import { Button } from "@repo/ui/button";
import { Badge } from "@repo/ui/badge";
import { Vote, RefreshCw, TrendingUp } from "lucide-react";
import { useUser } from "@auth0/nextjs-auth0/client";
import type { CommunityLook } from "../app/api/community/looks/route";

interface FaceoffPair {
  lookA: CommunityLook & { votes: number };
  lookB: CommunityLook & { votes: number };
}

export function LooksFaceoff() {
  const { user } = useUser();
  const [pair, setPair] = useState<FaceoffPair | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState<string | null>(null);
  const [voted, setVoted] = useState(false);
  const [showSplit, setShowSplit] = useState(false);

  const fetchPair = useCallback(async () => {
    setLoading(true);
    setVoted(false);
    setShowSplit(false);
    setVoting(null);
    try {
      const res = await fetch("/api/community/looks/faceoff");
      const data = await res.json();
      if (data.lookA && data.lookB) {
        setPair(data);
      } else {
        setPair(null);
      }
    } catch {
      setPair(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPair();
  }, [fetchPair]);

  const handleVote = useCallback(async (lookId: string) => {
    if (voting || voted) return;
    setVoting(lookId);

    try {
      await fetch("/api/community/looks/faceoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lookId, userId: user?.sub }),
      });
    } catch {
      // Non-critical
    }

    setVoted(true);
    setShowSplit(true);
    setVoting(null);
  }, [voting, voted, user]);

  const totalVotes = pair
    ? (pair.lookA.votes || 0) + (pair.lookB.votes || 0)
    : 0;
  const pctA = totalVotes > 0 ? Math.round(((pair?.lookA.votes || 0) / totalVotes) * 100) : 50;
  const pctB = totalVotes > 0 ? Math.round(((pair?.lookB.votes || 0) / totalVotes) * 100) : 50;

  if (loading) {
    return (
      <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Finding face-off...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!pair) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20 overflow-hidden">
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Vote className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold">Who Wore It Better?</h3>
          </div>
          <Badge variant="outline" className="text-[10px]">
            <TrendingUp className="h-3 w-3 mr-1" />
            Community Vote
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Look A */}
          <div
            className={`relative rounded-xl border-2 p-4 transition-all ${
              voted
                ? pctA >= pctB
                  ? "border-green-500/50 bg-green-500/5"
                  : "border-border opacity-60"
                : "border-border hover:border-primary/50 cursor-pointer"
            }`}
            onClick={() => !voted && handleVote(pair.lookA.id)}
          >
            {!voted && (
              <div className="absolute top-2 right-2 z-10">
                <Badge variant="secondary" className="text-[10px]">
                  Vote A
                </Badge>
              </div>
            )}
            <div className="min-h-[120px] bg-muted/50 rounded-lg mb-3 flex items-center justify-center p-4">
              <div className="text-center">
                <p className="text-sm font-medium line-clamp-2">{pair.lookA.headline}</p>
                <div className="flex flex-wrap gap-1 mt-2 justify-center">
                  {pair.lookA.topics.slice(0, 3).map((topic) => (
                    <Badge key={topic} variant="outline" className="text-[9px] px-1.5 py-0">
                      {topic}
                    </Badge>
                  ))}
                </div>
                {pair.lookA.persona && (
                  <p className="text-[10px] text-muted-foreground mt-2">
                    via {pair.lookA.persona}
                  </p>
                )}
              </div>
            </div>
            {showSplit && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className={pctA >= pctB ? "text-green-600" : ""}>
                    {pctA}%
                  </span>
                  <span className="text-muted-foreground">
                    {pair.lookA.votes} votes
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      pctA >= pctB ? "bg-green-500" : "bg-muted-foreground/30"
                    }`}
                    style={{ width: `${pctA}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Look B */}
          <div
            className={`relative rounded-xl border-2 p-4 transition-all ${
              voted
                ? pctB >= pctA
                  ? "border-green-500/50 bg-green-500/5"
                  : "border-border opacity-60"
                : "border-border hover:border-primary/50 cursor-pointer"
            }`}
            onClick={() => !voted && handleVote(pair.lookB.id)}
          >
            {!voted && (
              <div className="absolute top-2 right-2 z-10">
                <Badge variant="secondary" className="text-[10px]">
                  Vote B
                </Badge>
              </div>
            )}
            <div className="min-h-[120px] bg-muted/50 rounded-lg mb-3 flex items-center justify-center p-4">
              <div className="text-center">
                <p className="text-sm font-medium line-clamp-2">{pair.lookB.headline}</p>
                <div className="flex flex-wrap gap-1 mt-2 justify-center">
                  {pair.lookB.topics.slice(0, 3).map((topic) => (
                    <Badge key={topic} variant="outline" className="text-[9px] px-1.5 py-0">
                      {topic}
                    </Badge>
                  ))}
                </div>
                {pair.lookB.persona && (
                  <p className="text-[10px] text-muted-foreground mt-2">
                    via {pair.lookB.persona}
                  </p>
                )}
              </div>
            </div>
            {showSplit && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className={pctB >= pctA ? "text-green-600" : ""}>
                    {pctB}%
                  </span>
                  <span className="text-muted-foreground">
                    {pair.lookB.votes} votes
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      pctB >= pctA ? "bg-green-500" : "bg-muted-foreground/30"
                    }`}
                    style={{ width: `${pctB}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {voted && (
          <div className="mt-4 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchPair}
              className="gap-1"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Next Pair
            </Button>
          </div>
        )}

        {!voted && (
          <p className="text-[10px] text-center text-muted-foreground mt-3">
            Cast your vote — winning looks earn more visibility
          </p>
        )}
      </CardContent>
    </Card>
  );
}
