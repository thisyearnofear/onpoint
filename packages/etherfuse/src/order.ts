/**
 * Etherfuse onramp order helpers.
 *
 * An order is created from a quote. Once funded (SPEI / OXXO), Etherfuse
 * settles USDC to the recipient address on the requested chain and emits
 * a webhook we verify in `./webhook`.
 */

import type { EtherfuseClient } from "./client.js";
import type {
  CreateOrderRequest,
  CreateOrderResponse,
  OrderDetailsResponse,
  TopUpOrder,
  TopUpQuote,
  TopUpCredit,
  EtherfuseFiat,
  EtherfuseChain,
} from "./types.js";

const ETHERFUSE_ORDER_PATH = "/ramp/order";

export async function createOrder(
  client: EtherfuseClient,
  req: CreateOrderRequest,
): Promise<CreateOrderResponse> {
  return client.post<CreateOrderResponse>(ETHERFUSE_ORDER_PATH, req);
}

export async function getOrder(
  client: EtherfuseClient,
  orderId: string,
): Promise<OrderDetailsResponse> {
  return client.get<OrderDetailsResponse>(`${ETHERFUSE_ORDER_PATH}/${orderId}`);
}

export async function cancelOrder(
  client: EtherfuseClient,
  orderId: string,
): Promise<{ orderId: string; status: "cancelled" }> {
  return client.delete<{ orderId: string; status: "cancelled" }>(
    `${ETHERFUSE_ORDER_PATH}/${orderId}`,
  );
}

/** OnPoint-shaped wrapper that pairs a quote with a recipient. */
export function buildCreateOrderRequest(
  quote: TopUpQuote,
  idempotencyKey?: string,
): CreateOrderRequest {
  return {
    quoteId: quote.quoteId,
    recipientAddress: quote.recipientAddress,
    chain: quote.chain,
    idempotencyKey,
  };
}

export function toTopUpOrder(
  order: CreateOrderResponse,
  quote: TopUpQuote,
): TopUpOrder {
  return {
    orderId: order.orderId,
    status: order.status,
    fiat: quote.fiat,
    fiatAmount: quote.fiatAmount,
    cryptoAsset: quote.cryptoAsset,
    cryptoAmount: quote.cryptoAmount,
    recipientAddress: quote.recipientAddress,
    chain: quote.chain,
    createdAt: order.createdAt,
    expiresAt: order.expiresAt,
    paymentInstructions: order.paymentInstructions ?? quote.paymentInstructions,
  };
}

// ── List orders (for migration) ───────────────────────────────────────

export interface ListOrdersFilter {
  status?: "completed" | "failed" | "cancelled";
  pageSize?: number;
  pageNumber?: number;
}

export interface ListOrdersResponse {
  items: OrderDetailsResponse[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Fetch completed orders from Etherfuse. Used by the migration script to
 * replay past top-up credits into a Redis store.
 */
export async function listOrders(
  client: EtherfuseClient,
  filter: ListOrdersFilter = {},
): Promise<ListOrdersResponse> {
  return client.post<ListOrdersResponse>("/ramp/order/lookup", {
    status: filter.status ?? "completed",
    pageSize: filter.pageSize ?? 100,
    pageNumber: filter.pageNumber ?? 0,
  });
}

/**
 * Convert an Etherfuse order to a TopUpCredit record. Used by the
 * migration script to replay credits into the Redis ledger.
 *
 * Returns `null` when the order can't be credited (e.g. missing
 * recipientAddress, wrong type, or not completed).
 */
export function orderToTopUpCredit(
  order: OrderDetailsResponse,
  defaultFiat: EtherfuseFiat = "MXN",
  defaultCryptoAsset: string = "USDC",
  defaultChain: EtherfuseChain = "base",
): TopUpCredit | null {
  if (order.status !== "completed") return null;
  if (order.type !== "onramp") return null;
  if (!order.recipientAddress) return null;

  return {
    userAddress: order.recipientAddress as `0x${string}`,
    orderId: order.orderId,
    fiat: defaultFiat,
    fiatAmount: order.sourceAmount ?? "0",
    cryptoAsset: order.targetAsset ?? defaultCryptoAsset,
    cryptoAmount: order.targetAmount ?? "0",
    chain: order.chain ?? defaultChain,
    transactionHash: order.transactionHash,
    creditedAt: order.updatedAt ?? order.createdAt,
  };
}
