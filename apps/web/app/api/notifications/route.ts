/**
 * In-App Notifications API
 *
 * GET  /api/notifications          — Fetch notifications + unread count for the authenticated user
 * POST /api/notifications          — Mark a single notification as read  ({ notificationId })
 * POST /api/notifications?all=true — Mark all notifications as read
 */

import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "../ai/_utils/http";
import { logger } from "../../../lib/utils/logger";
import { requireAuthWithRateLimit } from "../../../middleware/agent-auth";
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "../../../lib/services/subscription-service";

export { OPTIONS } from "../ai/_utils/http";

export async function GET(request: NextRequest) {
  return requireAuthWithRateLimit(async (req, ctx) => {
    const origin = req.headers.get("origin") || "*";

    try {
      const [notifications, unreadCount] = await Promise.all([
        getNotifications(ctx.userId),
        getUnreadCount(ctx.userId),
      ]);

      return NextResponse.json(
        { notifications, unreadCount },
        { headers: corsHeaders(origin) },
      );
    } catch (error) {
      logger.error("Failed to fetch notifications", { component: "notifications" }, error);
      return NextResponse.json(
        { error: "Failed to fetch notifications" },
        { status: 500, headers: corsHeaders(origin) },
      );
    }
  })(request);
}

export async function POST(request: NextRequest) {
  return requireAuthWithRateLimit(async (req, ctx) => {
    const origin = req.headers.get("origin") || "*";

    try {
      const body = await req.json();

      if (body.all === true) {
        await markAllNotificationsRead(ctx.userId);
        return NextResponse.json(
          { success: true, message: "All notifications marked as read" },
          { headers: corsHeaders(origin) },
        );
      }

      if (body.notificationId) {
        await markNotificationRead(ctx.userId, body.notificationId);
        return NextResponse.json(
          { success: true },
          { headers: corsHeaders(origin) },
        );
      }

      return NextResponse.json(
        { error: "Provide notificationId or { all: true }" },
        { status: 400, headers: corsHeaders(origin) },
      );
    } catch (error) {
      logger.error("Failed to update notification", { component: "notifications" }, error);
      return NextResponse.json(
        { error: "Failed to update notification" },
        { status: 500, headers: corsHeaders(origin) },
      );
    }
  })(request);
}
