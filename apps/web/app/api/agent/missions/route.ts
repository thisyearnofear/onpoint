/**
 * Missions API
 *
 * Progress tracking and claims for gamified style challenges.
 */

import { NextRequest, NextResponse } from "next/server";
import { MissionService } from "../../../../lib/services/mission-service";
import { requireAuthWithRateLimit } from "../../../../middleware/agent-auth";
import { logger } from "../../../../lib/utils/logger";

// GET /api/agent/missions — Get all missions and user progress
// Wallet-only accessible: if Auth0 auth fails, falls back to wallet-based
// userId so the G$ Style Streak loop works without an Auth0 account.
export async function GET(req: NextRequest) {
  // First try authenticated path (Auth0 or SIWE)
  const authResult = await requireAuthWithRateLimit(async (req, _ctx) => {
    return await handleGetMissions(req);
  })(req);

  // If auth succeeded, return the result
  if (authResult.status !== 401) {
    return authResult;
  }

  // Fall back to wallet-based access (no Auth0 required)
  // This enables the G$ loop for wallet-only users
  return handleGetMissions(req);
}

async function handleGetMissions(req: NextRequest) {
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
    logger.error("Missions GET error", { component: "missions" }, error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch missions" },
      { status: 500 },
    );
  }
}

// POST /api/agent/missions — Update mission progress
// Wallet-only accessible for g-claim-streak events: if Auth0 auth fails,
// falls back to wallet-based userId so the G$ Style Streak sync from
// GClaimCTA works without an Auth0 account. Other event types still
// require auth.
export async function POST(req: NextRequest) {
  // First try authenticated path
  const authResult = await requireAuthWithRateLimit(async (req, _ctx) => {
    return await handlePostMissions(req);
  })(req);

  // If auth succeeded, return the result
  if (authResult.status !== 401) {
    return authResult;
  }

  // Auth failed — check if this is a wallet-based streak event
  // (the G$ loop's display-only sync from GClaimCTA). Allow through.
  try {
    const body = await req.json();
    if (body.eventType === "g-claim-streak" && body.userId) {
      return handlePostMissions(req, body);
    }
  } catch {
    // Body parse failed — fall through to 401
  }

  return NextResponse.json(
    { error: "Authentication required" },
    { status: 401 },
  );
}

async function handlePostMissions(req: NextRequest, preParsedBody?: any) {
  try {
    const body = preParsedBody || await req.json();
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
    logger.error("Missions POST error", { component: "missions" }, error);
    return NextResponse.json(
      { success: false, error: "Failed to update mission progress" },
      { status: 500 },
    );
  }
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
      logger.error("Missions PUT error", { component: "missions" }, error);
      return NextResponse.json(
        { success: false, error: "Failed to claim mission reward" },
        { status: 500 },
      );
    }
  })(req);
}
