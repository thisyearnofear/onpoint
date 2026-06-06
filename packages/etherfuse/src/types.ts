/**
 * Etherfuse FX API — typed request/response shapes
 *
 * Source of truth for the Etherfuse integration. Consumed by:
 *   - apps/api/routes/agent-topup.js (Express, CommonJS)
 *   - apps/web/app/api/agent/topup/route.ts (Next.js, ESM)
 *
 * Only the fields OnPoint actually uses are typed. The full schema is
 * documented at https://docs.etherfuse.com/api-reference.
 */

export type EtherfuseEnvironment = "sandbox" | "production";

export type EtherfuseChain = "celo" | "base" | "ethereum" | "polygon";

export type EtherfuseFiat = "MXN" | "USD" | "EUR";

export type EtherfuseAsset =
  | "USDC"
  | "EURC"
  | "CETES"
  | (string & {}); // open-ended; new rampable assets allowed

export type EtherfuseOrderType = "onramp" | "offramp" | "swap";

export type EtherfuseOrderStatus =
  | "created"
  | "pending_payment"
  | "payment_received"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

export interface EtherfuseConfig {
  apiKey: string;
  environment: EtherfuseEnvironment;
  /** Override the base URL (e.g. for local proxying). */
  baseUrl?: string;
  /** Default chain for onramp settlement. */
  defaultChain?: EtherfuseChain;
  /** Default fiat currency (Bitso/Mexico focus = MXN). */
  defaultFiat?: EtherfuseFiat;
  /** Webhook signing secret. Required to verify webhooks. */
  webhookSecret?: string;
  /** Request timeout (ms). */
  timeoutMs?: number;
}

// ─── Quotes ──────────────────────────────────────────────────────────

export interface QuoteRequest {
  type: EtherfuseOrderType;
  /** ISO currency code (fiat) or asset identifier (crypto). */
  sourceAsset: string;
  /** Asset identifier (crypto) or ISO currency code (fiat). */
  targetAsset: string;
  /** Amount in source units, as string to preserve precision. */
  amount: string;
  /** Optional chain hint for asset resolution. */
  chain?: EtherfuseChain;
}

export interface QuoteResponse {
  quoteId: string;
  type: EtherfuseOrderType;
  sourceAsset: string;
  targetAsset: string;
  sourceAmount: string;
  targetAmount: string;
  /** Effective rate after fees. */
  rate: string;
  /** Total fees in source units. */
  fees: string;
  /** Quoted expiry, ISO 8601. */
  expiresAt: string;
  /** Optional payment instructions (SPEI CLABE, OXXO barcode, etc.). */
  paymentInstructions?: {
    method: "spei" | "oxxo" | "wire" | string;
    clabe?: string;
    reference?: string;
    barcodeUrl?: string;
    expiresAt?: string;
  };
}

// ─── Orders ──────────────────────────────────────────────────────────

export interface CreateOrderRequest {
  quoteId: string;
  /** Onchain wallet to receive the crypto (0x address for EVM). */
  recipientAddress: string;
  chain: EtherfuseChain;
  /** Optional customer identifier (Etherfuse creates one if absent). */
  customerId?: string;
  /** Optional idempotency key so retries don't double-spend. */
  idempotencyKey?: string;
}

export interface CreateOrderResponse {
  orderId: string;
  status: EtherfuseOrderStatus;
  type: EtherfuseOrderType;
  sourceAsset: string;
  targetAsset: string;
  sourceAmount: string;
  targetAmount: string;
  recipientAddress: string;
  chain: EtherfuseChain;
  createdAt: string;
  /** When the order expires if not funded. */
  expiresAt?: string;
  paymentInstructions?: QuoteResponse["paymentInstructions"];
}

export interface OrderDetailsResponse extends CreateOrderResponse {
  /** Tx hash of the onchain settlement, when available. */
  transactionHash?: string;
  /** Last update timestamp. */
  updatedAt: string;
  /** Failure reason, if status === "failed". */
  failureReason?: string;
}

// ─── Webhooks ────────────────────────────────────────────────────────

export type EtherfuseWebhookEvent =
  | "order.created"
  | "order.payment_received"
  | "order.processing"
  | "order.completed"
  | "order.failed"
  | "order.cancelled"
  | "swap.updated";

export interface EtherfuseWebhookPayload {
  event: EtherfuseWebhookEvent;
  orderId: string;
  status: EtherfuseOrderStatus;
  /** Source amount in source units (string). */
  sourceAmount?: string;
  /** Target amount in target units (string). */
  targetAmount?: string;
  recipientAddress?: string;
  chain?: EtherfuseChain;
  transactionHash?: string;
  failureReason?: string;
  timestamp: string;
  /** Customer-defined metadata, echoed back. */
  metadata?: Record<string, string>;
}

// ─── OnPoint top-up domain ───────────────────────────────────────────

export interface TopUpRequest {
  /** User's EVM address that will receive the USDC. */
  userAddress: `0x${string}`;
  /** Fiat amount in major units, e.g. "100.00" for 100 MXN. */
  fiatAmount: string;
  fiat: EtherfuseFiat;
  chain?: EtherfuseChain;
  /** Optional metadata echoed back on the webhook (e.g. sessionId). */
  metadata?: Record<string, string>;
}

export interface TopUpQuote {
  quoteId: string;
  fiat: EtherfuseFiat;
  fiatAmount: string;
  cryptoAsset: string;
  cryptoAmount: string;
  rate: string;
  fees: string;
  expiresAt: string;
  paymentInstructions?: QuoteResponse["paymentInstructions"];
  chain: EtherfuseChain;
  recipientAddress: `0x${string}`;
}

export interface TopUpOrder {
  orderId: string;
  status: EtherfuseOrderStatus;
  fiat: EtherfuseFiat;
  fiatAmount: string;
  cryptoAsset: string;
  cryptoAmount: string;
  recipientAddress: `0x${string}`;
  chain: EtherfuseChain;
  createdAt: string;
  expiresAt?: string;
  paymentInstructions?: QuoteResponse["paymentInstructions"];
}

// ─── Internal balance ledger ─────────────────────────────────────────

/**
 * After a successful top-up, the credited amount lives in a per-user
 * ledger that the existing `agent-wallet` route reads. Spend policy
 * treats onramp credits as a positive adjustment, not a spend.
 */
export interface TopUpCredit {
  userAddress: `0x${string}`;
  orderId: string;
  fiat: EtherfuseFiat;
  fiatAmount: string;
  cryptoAsset: string;
  cryptoAmount: string;
  chain: EtherfuseChain;
  transactionHash?: string;
  creditedAt: string;
}
