import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithRateLimit } from "../../../../middleware/agent-auth";
import { getUserOrders, getOrder } from "../../../../lib/services/order-service";
import { corsHeaders } from "../../ai/_utils/http";
import { logger } from "../../../../lib/utils/logger";
export { OPTIONS } from "../../ai/_utils/http";

export async function GET(request: NextRequest) {
  return requireAuthWithRateLimit(async (req, ctx) => {
    const origin = req.headers.get("origin") ?? undefined;
    try {
      const url = new URL(req.url);
      const orderId = url.searchParams.get("id");

      if (orderId) {
        const order = await getOrder(ctx.userId, orderId);
        if (!order) {
          return NextResponse.json(
            { error: "Order not found" },
            { status: 404, headers: corsHeaders(origin) },
          );
        }
        return NextResponse.json({ order }, { headers: corsHeaders(origin) });
      }

      const orders = await getUserOrders(ctx.userId);
      return NextResponse.json({ orders }, { headers: corsHeaders(origin) });
    } catch (error) {
      logger.error("Failed to fetch orders", { component: "orders" }, error);
      return NextResponse.json(
        { error: "Failed to fetch orders" },
        { status: 500, headers: corsHeaders(origin) },
      );
    }
  })(request);
}
