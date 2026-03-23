/**
 * Style Context API
 * 
 * CRUD operations for StyleContextStore — unified style memory
 * bridging Virtual Try-On and Live AR sessions.
 */

import { NextRequest, NextResponse } from "next/server";
import { StyleContextStore } from "../../../../lib/services/style-context-store";

// GET /api/agent/style-context — Get unified context
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || "user-default";
    const limit = parseInt(searchParams.get("limit") || "5");

    const context = await StyleContextStore.getUnifiedContext(userId);
    const recentAnalyses = await StyleContextStore.getRecentAnalyses(userId, limit);
    const insights = await StyleContextStore.getCrossFeatureInsights(userId);

    return NextResponse.json({
      success: true,
      context: {
        preferences: context.preferences,
        recentAnalyses,
        sessionGoals: context.sessionGoals.slice(0, 5),
        lastActiveSource: context.lastActiveSource,
        crossFeatureInsights: insights,
      },
    });
  } catch (error) {
    console.error("Style context GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch style context" },
      { status: 500 }
    );
  }
}

// POST /api/agent/style-context — Record a style analysis
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, source, type, content, metadata } = body;

    if (!userId || !source || !type || !content) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: userId, source, type, content" },
        { status: 400 }
      );
    }

    await StyleContextStore.recordStyleAnalysis(userId, {
      source,
      type,
      content,
      metadata: metadata || {},
    });

    return NextResponse.json({
      success: true,
      message: "Style analysis recorded",
    });
  } catch (error) {
    console.error("Style context POST error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to record style analysis" },
      { status: 500 }
    );
  }
}

// PUT /api/agent/style-context/goal — Record a session goal
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, goal } = body;

    if (!userId || !goal) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: userId, goal" },
        { status: 400 }
      );
    }

    await StyleContextStore.recordSessionGoal(userId, goal);

    return NextResponse.json({
      success: true,
      message: "Session goal recorded",
    });
  } catch (error) {
    console.error("Style context PUT error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to record session goal" },
      { status: 500 }
    );
  }
}