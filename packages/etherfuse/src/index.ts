/**
 * @repo/etherfuse — Etherfuse FX API integration for OnPoint
 *
 * Public surface. Re-exports every module so consumers can `import { ... }
 * from "@repo/etherfuse"` instead of reaching into subpaths.
 *
 * Design notes:
 *   - Single source of truth for the Etherfuse HTTP client, quote/order
 *     helpers, webhook verification, and the per-user top-up ledger.
 *   - Consumed by both the Next.js web app (ESM) and the Express API
 *     server (CJS via the tsup build).
 *   - No business logic. Routes decide how to use these primitives.
 */

export type {
  EtherfuseConfig,
  EtherfuseEnvironment,
  EtherfuseChain,
  EtherfuseFiat,
  EtherfuseAsset,
  EtherfuseOrderType,
  EtherfuseOrderStatus,
  QuoteRequest,
  QuoteResponse,
  CreateOrderRequest,
  CreateOrderResponse,
  OrderDetailsResponse,
  EtherfuseWebhookEvent,
  EtherfuseWebhookPayload,
  TopUpRequest,
  TopUpQuote,
  TopUpOrder,
  TopUpCredit,
} from "./types.js";

export {
  ETHERFUSE_DEFAULT_BASES,
  EtherfuseApiError,
  createEtherfuseClient,
  etherfuseClientFromEnv,
  type EtherfuseClient,
} from "./client.js";

export {
  getOnrampQuote,
  getTopUpQuote,
  getPublicExchangeRate,
} from "./quote.js";

export {
  createOrder,
  getOrder,
  cancelOrder,
  buildCreateOrderRequest,
  toTopUpOrder,
  listOrders,
  orderToTopUpCredit,
  type ListOrdersFilter,
  type ListOrdersResponse,
} from "./order.js";

export {
  ETHERFUSE_SIGNATURE_HEADER,
  computeSignature,
  verifyWebhookSignature,
  parseVerifiedWebhook,
  isCreditableEvent,
} from "./webhook.js";

export {
  getTopUpBalanceStore,
  getTopUpBalance,
  setTopUpRedisClient,
  createRedisTopUpBalanceStore,
  __setTopUpBalanceStore,
  type TopUpBalanceStore,
} from "./balances.js";
