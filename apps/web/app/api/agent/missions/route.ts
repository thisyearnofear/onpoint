/**
 * Missions API
 *
 * Progress tracking and claims for gamified style challenges.
 */

import { NextRequest, NextResponse } from "next/server";
import { MissionService } from "../../../../lib/services/mission-service";
import { requireAuthWithRateLimit } from "../../../../middleware/agent-auth";

// GET /api/agent/missions — Get all missions and user progress
export async function GET(req: NextRequest) {
  return requireAuthWithRateLimit(async (req, _ctx) => {
    try {
      const { searchParams } = new URL(req.url);
      const userId = searchParams.get("userId") || "user-default";
      const category = searchParams.get("category");

      const allMissions = category
        ? MissionService.getMissionsByCategory(category as any)
        : MissionService.getAllMissions();

      const userState = MissionService.getUserMissionState(userId);
      const completedMissions = MissionService.getCompletedMissions(userId);
      const inProgressMissions = MissionService.getInProgressMissions(userId);

      return NextResponse.json({
        success: true,
        missions: allMissions,
        userState: {
          totalXp: userState.totalXp,
          badges: userState.badges,
          completedCount: completedMissions.length,
          inProgressCount: inProgressMissions.length,
          missions: userState.missions,
        },
      });
    } catch (error) {
      console.error("Missions GET error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch missions" },
        { status: 500 },
      );
    }
  })(req);
}

// POST /api/agent/missions — Update mission progress
export async function POST(req: NextRequest) {
  return requireAuthWithRateLimit(async (req, _ctx) => {
    try {
      const body = await req.json();
      const { userId, eventType, metadata } = body;

      if (!userId || !eventType) {
        return NextResponse.json(
          {
            success: false,
            error: "Missing required fields: userId, eventType",
          },
          { status: 400 },
        );
      }

      const updates = MissionService.updateMissionProgress(
        userId,
        eventType,
        metadata,
      );

      return NextResponse.json({
        success: true,
        updates,
        message: `Mission progress updated for event: ${eventType}`,
      });
    } catch (error) {
      console.error("Missions POST error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to update mission progress" },
        { status: 500 },
      );
    }
  })(req);
}

// PUT /api/agent/missions/claim — Claim a mission reward
export async function PUT(req: NextRequest) {
  return requireAuthWithRateLimit(async (req, _ctx) => {
    try {
      const body = await req.json();
      const { userId, missionId } = body;

      if (!userId || !missionId) {
        return NextResponse.json(
          {
            success: false,
            error: "Missing required fields: userId, missionId",
          },
          { status: 400 },
        );
      }

      const result = MissionService.claimMissionReward(userId, missionId);

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Cannot claim reward — mission not completed or already claimed",
          },
          { status: 400 },
        );
      }

      return NextResponse.json({
        success: true,
        reward: result.reward,
        message: "Mission reward claimed successfully",
      });
    } catch (error) {
      console.error("Missions PUT error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to claim mission reward" },
        { status: 500 },
      );
    }
  })(req);
}
