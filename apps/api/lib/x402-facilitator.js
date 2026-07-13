/**
 * Celo x402 Facilitator Client
 *
 * Integrates with the Celo-hosted x402 facilitator at api.x402.celo.org.
 * The facilitator settles USDC/USDT payments on Celo mainnet via the
 * gasless EIP-3009 transferWithAuthorization scheme — the buyer signs an
 * off-chain authorization, the facilitator submits it on-chain and pays
 * the gas itself. Funds move directly payer → payee inside the token
 * contract; the facilitator never custodies funds.
 *
 * This module provides:
 *  - buildFacilitatorRequirements(): v2 PaymentRequirements for the 402 challenge
 *  - processFacilitatorPayment(): verify + settle via the facilitator
 *
 * Usage in routes:
 *   const x402 = require('../lib/x402-facilitator');
 *   const xPayment = req.headers['x-payment'];
 *   if (xPayment) {
 *     const result = await x402.processFacilitatorPayment(xPayment, requirements);
 *     if (!result.success) return res.status(402).json({ error: result.error });
 *     // payment settled — proceed with the request
 *   }
 *
 * Docs: https://docs.celo.org/build-on-celo/build-with-ai/x402
 */

const FACILITATOR_URL =
  process.env.X402_FACILITATOR_URL || 'https://api.x402.celo.org';

// USDC on Celo mainnet (EIP-3009 transferWithAuthorization)
const USDC_CELO_MAINNET = '0xcEBA9300f2b948710d2653dD7B07f33A8B32118C';
const USDC_DECIMALS = 6;

// USDT on Celo mainnet (EIP-3009 transferWithAuthorization)
const USDT_CELO_MAINNET = '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e';
const USDT_DECIMALS = 6;

const CELO_MAINNET_NETWORK = 'eip155:42220';

/**
 * Build x402 v2 PaymentRequirements for a USDC payment via the facilitator.
 *
 * @param {number} usdAmount    Dollar amount (e.g. 0.05)
 * @param {string} payTo        Recipient address (the seller's wallet)
 * @param {string} resource     Full URL of the gated resource
 * @param {string} description  Human-readable description
 * @param {object} [opts]      Optional: { asset: 'USDT' } to use USDT instead
 */
function buildFacilitatorRequirements(
  usdAmount,
  payTo,
  resource,
  description,
  opts = {},
) {
  const useUSDT = opts.asset === 'USDT';
  const tokenAddress = useUSDT ? USDT_CELO_MAINNET : USDC_CELO_MAINNET;
  const decimals = useUSDT ? USDT_DECIMALS : USDC_DECIMALS;
  const eip712Name = useUSDT ? 'Tether USD' : 'USDC';
  const eip712Version = useUSDT ? '1' : '2';

  // Convert USD to smallest unit (USDC/USDT have 6 decimals)
  const micros = BigInt(Math.round(usdAmount * 1_000_000));

  return {
    version: '2',
    scheme: 'exact',
    network: CELO_MAINNET_NETWORK,
    // CAIP-19 asset reference for the EIP-3009 token
    asset: `${CELO_MAINNET_NETWORK}/erc20:${tokenAddress}`,
    amount: micros.toString(),
    to: payTo,
    resource,
    description,
    mimeType: 'application/json',
    maxTimeoutSeconds: 300,
    // Metadata for the client to build the EIP-712 signature
    metadata: {
      tokenAddress,
      decimals,
      eip712: { name: eip712Name, version: eip712Version },
    },
  };
}

/**
 * Verify a payment via the facilitator's /verify endpoint.
 * Checks the signature and on-chain state without modifying anything.
 *
 * @param {object} paymentPayload     The signed PaymentPayload from X-PAYMENT header
 * @param {object} paymentRequirements The matching PaymentRequirements
 * @returns {Promise<object>}         { isValid, invalidReason?, invalidMessage? }
 */
async function verifyPayment(paymentPayload, paymentRequirements) {
  const resp = await fetch(`${FACILITATOR_URL}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentPayload, paymentRequirements }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    return {
      isValid: false,
      invalidReason: 'facilitator_error',
      invalidMessage: `Facilitator verify returned ${resp.status}: ${text}`,
    };
  }

  return resp.json();
}

/**
 * Settle a payment via the facilitator's /settle endpoint.
 * Submits the buyer's authorization on-chain (facilitator pays gas).
 *
 * @param {object} paymentPayload     The signed PaymentPayload
 * @param {object} paymentRequirements The matching PaymentRequirements
 * @returns {Promise<object>}         { success, transaction?, network?, errorReason?, errorMessage? }
 */
async function settlePayment(paymentPayload, paymentRequirements) {
  const resp = await fetch(`${FACILITATOR_URL}/settle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentPayload, paymentRequirements }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    return {
      success: false,
      errorReason: 'facilitator_error',
      errorMessage: `Facilitator settle returned ${resp.status}: ${text}`,
    };
  }

  return resp.json();
}

/**
 * Process a facilitator payment from the X-PAYMENT header.
 * Verifies and settles in one call. Returns the settlement tx hash on success.
 *
 * @param {string} xPaymentHeader     The raw X-PAYMENT header value
 * @param {object} paymentRequirements The PaymentRequirements for this resource
 * @returns {Promise<object>}         { success, txHash?, network?, error? }
 */
async function processFacilitatorPayment(xPaymentHeader, paymentRequirements) {
  // The X-PAYMENT header contains the PaymentPayload.
  // It may be base64-encoded JSON or raw JSON.
  let paymentPayload;
  try {
    // Try base64 first
    const decoded = Buffer.from(xPaymentHeader, 'base64').toString('utf-8');
    paymentPayload = JSON.parse(decoded);
  } catch {
    // Fall back to raw JSON
    try {
      paymentPayload = JSON.parse(xPaymentHeader);
    } catch {
      return {
        success: false,
        error: 'Invalid X-PAYMENT header: could not decode as base64 or JSON',
      };
    }
  }

  // Step 1: Verify the payment signature and on-chain state
  const verifyResult = await verifyPayment(paymentPayload, paymentRequirements);
  if (!verifyResult.isValid) {
    return {
      success: false,
      error:
        verifyResult.invalidMessage ||
        verifyResult.invalidReason ||
        'Payment verification failed',
      verifyResult,
    };
  }

  // Step 2: Settle the payment on-chain (facilitator pays gas)
  const settleResult = await settlePayment(paymentPayload, paymentRequirements);
  if (!settleResult.success) {
    return {
      success: false,
      error:
        settleResult.errorMessage ||
        settleResult.errorReason ||
        'Payment settlement failed',
      settleResult,
    };
  }

  return {
    success: true,
    txHash: settleResult.transaction,
    network: settleResult.network,
  };
}

module.exports = {
  FACILITATOR_URL,
  USDC_CELO_MAINNET,
  USDT_CELO_MAINNET,
  USDC_DECIMALS,
  USDT_DECIMALS,
  CELO_MAINNET_NETWORK,
  buildFacilitatorRequirements,
  verifyPayment,
  settlePayment,
  processFacilitatorPayment,
};
