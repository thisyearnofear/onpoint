"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent } from "@repo/ui/card";
import { Button } from "@repo/ui/button";
import { Badge } from "@repo/ui/badge";
import { Progress } from "@repo/ui/progress";
import {
  Sparkles,
  Users,
  Shield,
  Star,
  Crown,
  Search,
  Gem,
  Layers,
  ShoppingBag,
  Share2,
  ChevronRight,
  Gift,
  CheckCircle,
  Lock,
  Zap,
  Target,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MissionService,
  type Mission,
  type MissionCategory,
  type UserMissionProgress,
} from "../../lib/services/mission-service";

// ── Icon Map ──

const ICON_MAP: Record<string, React.ElementType> = {
  Sparkles,
  Users,
  Shield,
  Star,
  Crown,
  Search,
  Gem,
  Layers,
  ShoppingBag,
  Share2,
};

// ── Category Styling ──

const CATEGORY_STYLES: Record<
  MissionCategory,
  { label: string; color: string; bg: string; border: string }
> = {
  explorer: {
    label: "Explorer",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
  stylist: {
    label: "Stylist",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
  },
  collector: {
    label: "Collector",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
  economy: {
    label: "Economy",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
  social: {
    label: "Social",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
  },
};

// ── Component ──

interface MissionsPanelProps {
  userId: string;
  compact?: boolean;
}

export function MissionsPanel({ userId, compact = false }: MissionsPanelProps) {
  const [selectedCategory, setSelectedCategory] = useState<MissionCategory | "all">("all");
  const [expandedMission, setExpandedMission] = useState<string | null>(null);

  const state = MissionService.getUserMissionState(userId);
  const allMissions = MissionService.getAllMissions();

  const filteredMissions =
    selectedCategory === "all"
      ? allMissions
      : allMissions.filter((m) => m.category === selectedCategory);

  const completedCount = state.missions.filter((m) => m.completed).length;
  const totalCount = allMissions.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const handleClaimReward = useCallback(
    (missionId: string) => {
      MissionService.claimMissionReward(userId, missionId);
    },
    [userId],
  );

  if (compact) {
    return (
      <Card className="bg-slate-900/50 border-white/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-bold text-white">Missions</span>
            </div>
            <Badge variant="outline" className="text-[10px] text-indigo-400 border-indigo-500/30">
              {completedCount}/{totalCount}
            </Badge>
          </div>
          <Progress value={progressPercent} className="h-1.5 bg-white/5" />
          <div className="mt-3 flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs text-amber-400 font-bold">{state.totalXp} XP</span>
            {state.badges.length > 0 && (
              <>
                <span className="text-white/20">•</span>
                <span className="text-xs text-white/50">{state.badges.length} badges</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-900/50 border-white/5">
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <Target className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Style Missions</h3>
              <p className="text-[10px] text-white/40">
                {completedCount}/{totalCount} completed
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs text-amber-400 font-bold">{state.totalXp}</span>
            </div>
            {state.badges.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-xs text-purple-400 font-bold">{state.badges.length}</span>
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <Progress value={progressPercent} className="h-2 bg-white/5" />
          <p className="text-[10px] text-white/30 text-right">
            {Math.round(progressPercent)}% complete
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedCategory("all")}
            className={`text-[10px] px-3 py-1 rounded-full whitespace-nowrap ${
              selectedCategory === "all"
                ? "bg-white/10 text-white"
                : "text-white/40 hover:text-white hover:bg-white/5"
            }`}
          >
            All
          </Button>
          {(Object.keys(CATEGORY_STYLES) as MissionCategory[]).map((cat) => (
            <Button
              key={cat}
              variant="ghost"
              size="sm"
              onClick={() => setSelectedCategory(cat)}
              className={`text-[10px] px-3 py-1 rounded-full whitespace-nowrap ${
                selectedCategory === cat
                  ? `${CATEGORY_STYLES[cat].bg} ${CATEGORY_STYLES[cat].color} ${CATEGORY_STYLES[cat].border} border`
                  : "text-white/40 hover:text-white hover:bg-white/5"
              }`}
            >
              {CATEGORY_STYLES[cat].label}
            </Button>
          ))}
        </div>

        {/* Mission List */}
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {filteredMissions.map((mission) => {
              const progress = state.missions.find((m) => m.missionId === mission.id);
              const isCompleted = progress?.completed || false;
              const isExpanded = expandedMission === mission.id;
              const Icon = ICON_MAP[mission.icon] || Sparkles;
              const catStyle = CATEGORY_STYLES[mission.category];

              return (
                <motion.div
                  key={mission.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  layout
                >
                  <div
                    className={`rounded-xl border p-3 cursor-pointer transition-all ${
                      isCompleted
                        ? "bg-emerald-500/5 border-emerald-500/20"
                        : "bg-white/[0.02] border-white/5 hover:border-white/10"
                    }`}
                    onClick={() => setExpandedMission(isExpanded ? null : mission.id)}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isCompleted
                            ? "bg-emerald-500/20"
                            : catStyle.bg
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Icon className={`w-4 h-4 ${catStyle.color}`} />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4
                            className={`text-sm font-bold ${
                              isCompleted ? "text-emerald-400" : "text-white"
                            }`}
                          >
                            {mission.title}
                          </h4>
                          <div className="flex items-center gap-1.5">
                            {mission.reward.type === "xp" && (
                              <span className="text-[10px] text-amber-400 font-bold">
                                +{mission.reward.value} XP
                              </span>
                            )}
                            {mission.reward.type === "badge" && (
                              <Star className="w-3 h-3 text-purple-400" />
                            )}
                            <ChevronRight
                              className={`w-3.5 h-3.5 text-white/30 transition-transform ${
                                isExpanded ? "rotate-90" : ""
                              }`}
                            />
                          </div>
                        </div>

                        {/* Progress Bar */}
                        {!isCompleted && progress && (
                          <div className="mt-2">
                            <Progress
                              value={(progress.currentProgress / mission.maxProgress) * 100}
                              className="h-1 bg-white/5"
                            />
                            <p className="text-[10px] text-white/30 mt-1">
                              {progress.currentProgress}/{mission.maxProgress}
                            </p>
                          </div>
                        )}

                        {/* Expanded Details */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                                <p className="text-xs text-white/60 leading-relaxed">
                                  {mission.description}
                                </p>

                                {/* Requirements */}
                                <div className="space-y-1">
                                  <p className="text-[10px] text-white/30 font-bold uppercase tracking-wider">
                                    Requirements
                                  </p>
                                  {mission.requirements.map((req, i) => (
                                    <div
                                      key={i}
                                      className="flex items-center gap-2 text-[10px] text-white/50"
                                    >
                                      <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                                      <span>
                                        {req.type === "session-complete" && "Complete a session"}
                                        {req.type === "score-threshold" &&
                                          `Score ${req.threshold}+${req.target ? ` with ${req.target}` : ""}`}
                                        {req.type === "mint-count" && `Mint ${req.threshold} NFT(s)`}
                                        {req.type === "purchase-count" && "Complete a purchase"}
                                        {req.type === "spending-limit-set" && "Set a spending limit"}
                                        {req.type === "catalog-browse" &&
                                          `Browse ${req.threshold} categories`}
                                        {req.type === "persona-used" &&
                                          `Use ${req.threshold} different personas`}
                                        {req.type === "share-count" && "Share a Style Report"}
                                      </span>
                                    </div>
                                  ))}
                                </div>

                                {/* Claim Button */}
                                {isCompleted && !progress?.claimedReward && (
                                  <Button
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleClaimReward(mission.id);
                                    }}
                                    className="w-full mt-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white rounded-lg text-xs font-bold"
                                  >
                                    <Gift className="w-3.5 h-3.5 mr-1.5" />
                                    Claim Reward
                                  </Button>
                                )}

                                {isCompleted && progress?.claimedReward && (
                                  <div className="flex items-center gap-1.5 mt-2 text-emerald-400">
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    <span className="text-[10px] font-bold">Reward claimed</span>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Badges Section */}
        {state.badges.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-white/5">
            <p className="text-[10px] text-white/30 font-bold uppercase tracking-wider">
              Earned Badges
            </p>
            <div className="flex flex-wrap gap-2">
              {state.badges.map((badge) => (
                <div
                  key={badge}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20"
                >
                  <Star className="w-3 h-3 text-purple-400" />
                  <span className="text-[10px] text-purple-300 font-bold capitalize">
                    {badge.replace(/-/g, " ")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}