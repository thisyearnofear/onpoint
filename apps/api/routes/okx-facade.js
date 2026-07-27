/**
 * OKX A2MCP Facade — /okx/*
 *
 * Exposes OnPoint's paid capabilities as x402 pay-per-call endpoints that
 * settle on XLayer (eip155:196) in USD₮0, so OKX Agentic Wallet users can
 * pay seamlessly without bridging to Celo.
 *
 * Two operating modes:
 *   • Credentials present (OKX_API_KEY/SECRET_KEY/PASSPHRASE) — uses the
 *     OKX Payment SDK middleware: full 402 challenge + on-chain verify +
 *     settle + replay. Live paid calls work end-to-end.
 *   • Credentials absent — hand-builds a spec-compliant v2 402 challenge
 *     in the PAYMENT-REQUIRED header so the A2MCP self-check
 *     (`curl -i -X POST` → 402 + PAYMENT-REQUIRED) passes and the ASP can
 *     be listed. Live paid calls return 402 with a "facilitator not
 *     configured" message until creds are added. This unblocks submission
 *     before the OKX developer credentials are issued.
 *
 * In both modes, after payment is verified the request is relayed to the
 * existing Celo backend (/api/agent/try-on) with a service-key bypass
 * (see agent-tryon.js `okxBypass`) so the backend does the real work
 * without re-issuing a Celo 402.
 *
 * Env:
 *   OKX_PAY_TO_ADDRESS       — XLayer wallet receiving USD₮0 (REQUIRED for live traffic)
 *   OKX_API_KEY              — OKX developer portal API key (facilitator)
 *   OKX_SECRET_KEY           — OKX developer portal secret key
 *   OKX_PASSPHRASE           — OKX developer portal passphrase
 *   OKX_FACADE_PUBLIC_URL    — public base URL (default https://api.onpoint.famile.xyz)
 *   SERVICE_API_KEY          — existing internal service key (auths the relay)
 *   PORT                     — API port (for the internal localhost relay)
 */

const express = require('express');
const crypto = require('crypto');
const logger = require('../lib/logger');

const router = express.Router();

// ── XLayer mainnet (eip155:196), USD₮0 ────────────────────────────────
const NETWORK = 'eip155:196';
const XLAYER_USDT0 = '0x779Ded0c9e1022225f8E0630b35a9b54bE713736';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const TRYON_PRICE_USD = 0.05; // physical try-on price; flat for v1
const PUBLIC_BASE =
  (process.env.OKX_FACADE_PUBLIC_URL || 'https://api.onpoint.famile.xyz').replace(/\/$/, '');

const payTo = (process.env.OKX_PAY_TO_ADDRESS || ZERO_ADDRESS).toLowerCase();
if (payTo === ZERO_ADDRESS) {
  logger.warn(
    'OKX_PAY_TO_ADDRESS not set — /okx/try-on 402 challenge uses the zero address. Set it to your XLayer wallet before live traffic.',
    { component: 'okx-facade' },
  );
}

const hasOkxCreds =
  !!process.env.OKX_API_KEY &&
  !!process.env.OKX_SECRET_KEY &&
  !!process.env.OKX_PASSPHRASE;

// USD amount → smallest on-chain unit (USD₮0 has 6 decimals)
function usdToAtomic(usd) {
  return BigInt(Math.round(usd * 1_000_000)).toString();
}

// Build the v2 PaymentRequired challenge (OKX A2MCP spec form).
function buildV2Challenge(resourceUrl, description) {
  return {
    x402Version: 2,
    resource: {
      url: resourceUrl,
      description,
      mimeType: 'application/json',
    },
    accepts: [
      {
        scheme: 'exact',
        network: NETWORK,
        asset: XLAYER_USDT0,
        amount: usdToAtomic(TRYON_PRICE_USD),
        payTo,
        maxTimeoutSeconds: 300,
        extra: { name: 'USD₮0', version: '1', decimals: 6 },
      },
    ],
  };
}

function tryOnResourceUrl() {
  return `${PUBLIC_BASE}/okx/try-on`;
}

function browseResourceUrl() {
  return `${PUBLIC_BASE}/okx/browse`;
}

// ── POST /okx/try-on — relay to the Celo try-on backend ──────────────
// Runs after payment verification (SDK mode) or is never reached
// (no-creds mode — the gate above returns 402). The SDK middleware
// buffers this response and settles the OKX payment on-chain AFTER we
// respond — and only if status < 400 (render failure → no charge).
async function relayTryOn(req, res) {
  const internalTx = `okx_${crypto.randomUUID()}`;
  const port = process.env.PORT || 48751;
  const internalUrl = `http://localhost:${port}/api/agent/try-on`;

  if (!process.env.SERVICE_API_KEY) {
    return res
      .status(503)
      .json({ error: 'SERVICE_API_KEY not configured — relay unavailable' });
  }

  try {
    const upstream = await fetch(internalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-service-key': process.env.SERVICE_API_KEY,
        'x-okx-paid': '1',
        'x-okx-internal-tx': internalTx,
      },
      body: JSON.stringify(req.body || {}),
    });

    const text = await upstream.text();
    const contentType =
      upstream.headers.get('content-type') || 'application/json';
    res.status(upstream.status).setHeader('Content-Type', contentType);
    return res.send(text);
  } catch (err) {
    logger.error(
      'OKX facade relay to /api/agent/try-on failed',
      { component: 'okx-facade', internalTx },
      err,
    );
    return res
      .status(502)
      .json({ error: 'Try-on backend unreachable', retryable: true });
  }
}

// ── POST /okx/browse — relay to the free curator directory ───────────
// Zero-fee x402 service: the 402 challenge has amount="0". After payment
// verification (a zero-amount signature), relays to the internal GET
// /api/curator/directory?agentPurchasable=1 and returns the JSON.
async function relayBrowse(req, res) {
  const port = process.env.PORT || 48751;
  const internalUrl = `http://localhost:${port}/api/curator/directory?agentPurchasable=1`;

  try {
    const upstream = await fetch(internalUrl, {
      headers: { 'x-service-key': process.env.SERVICE_API_KEY || '' },
    });
    const text = await upstream.text();
    const contentType =
      upstream.headers.get('content-type') || 'application/json';
    res.status(upstream.status).setHeader('Content-Type', contentType);
    return res.send(text);
  } catch (err) {
    logger.error(
      'OKX facade relay to /api/curator/directory failed',
      { component: 'okx-facade' },
      err,
    );
    return res
      .status(502)
      .json({ error: 'Directory backend unreachable', retryable: true });
  }
}

// ── Mode selection ────────────────────────────────────────────────────
if (hasOkxCreds) {
  // Full OKX Payment SDK flow: 402 + verify + settle + replay.
  const { paymentMiddleware, x402ResourceServer } = require('@okxweb3/x402-express');
  const { OKXFacilitatorClient } = require('@okxweb3/x402-core');
  const { ExactEvmScheme } = require('@okxweb3/x402-evm');

  const facilitatorClient = new OKXFacilitatorClient({
    apiKey: process.env.OKX_API_KEY,
    secretKey: process.env.OKX_SECRET_KEY,
    passphrase: process.env.OKX_PASSPHRASE,
  });
  const resourceServer = new x402ResourceServer(facilitatorClient);
  resourceServer.register(NETWORK, new ExactEvmScheme());

  router.use(
    paymentMiddleware(
      {
        'POST /try-on': {
          accepts: [
            {
              scheme: 'exact',
              network: NETWORK,
              asset: XLAYER_USDT0,
              payTo,
              price: `$${TRYON_PRICE_USD}`,
              extra: { name: 'USD₮0', version: '1', decimals: 6 },
            },
          ],
          description:
            'OnPoint virtual try-on — render a curator listing on a person photo and get a fit signal before buying.',
          mimeType: 'application/json',
        },
        'POST /browse': {
          accepts: [
            {
              scheme: 'exact',
              network: NETWORK,
              asset: XLAYER_USDT0,
              payTo,
              price: '$0',
              extra: { name: 'USD₮0', version: '1', decimals: 6 },
            },
          ],
          description:
            'Browse OnPoint curator directory — discover fashion curators with agent-purchasable storefronts.',
          mimeType: 'application/json',
        },
      },
      resourceServer,
    ),
  );
  router.post('/try-on', relayTryOn);
  router.post('/browse', relayBrowse);
} else {
  // No-creds mode: hand-build the v2 402 challenge so the A2MCP
  // self-check passes and the ASP can be listed. Live paid calls
  // return 402 until OKX facilitator credentials are added.
  logger.warn(
    'OKX facilitator credentials not set — /okx/try-on running in self-check-only mode (402 challenge without verify/settle). Set OKX_API_KEY/OKX_SECRET_KEY/OKX_PASSPHRASE to enable live payments.',
    { component: 'okx-facade' },
  );

  const challenge = buildV2Challenge(
    tryOnResourceUrl(),
    'OnPoint virtual try-on — render a curator listing on a person photo and get a fit signal before buying.',
  );
  const challengeHeader = Buffer.from(JSON.stringify(challenge)).toString(
    'base64',
  );

  router.post('/try-on', (req, res) => {
    const hasPaymentHeader =
      req.header('payment-signature') || req.header('x-payment');
    // Always set the PAYMENT-REQUIRED header (v2 challenge, base64).
    res.setHeader('PAYMENT-REQUIRED', challengeHeader);
    if (hasPaymentHeader) {
      // A payment header was supplied but no facilitator is configured to
      // verify/settle it. Re-issue the 402 so the caller knows payment is
      // still required; live settlement activates once creds are added.
      return res.status(402).json({
        ...challenge,
        error:
          'OKX facilitator not configured — live settlement pending OKX API credentials. The 402 challenge is valid; add OKX_API_KEY/OKX_SECRET_KEY/OKX_PASSPHRASE to enable verify + settle.',
      });
    }
    return res.status(402).json({ ...challenge, error: 'Payment required' });
  });

  // Zero-fee browse challenge (amount="0" — free service, still x402-gated)
  const browseChallenge = {
    x402Version: 2,
    resource: {
      url: browseResourceUrl(),
      description:
        'Browse OnPoint curator directory — discover fashion curators with agent-purchasable storefronts.',
      mimeType: 'application/json',
    },
    accepts: [
      {
        scheme: 'exact',
        network: NETWORK,
        asset: XLAYER_USDT0,
        amount: '0',
        payTo,
        maxTimeoutSeconds: 300,
        extra: { name: 'USD₮0', version: '1', decimals: 6 },
      },
    ],
  };
  const browseChallengeHeader = Buffer.from(
    JSON.stringify(browseChallenge),
  ).toString('base64');

  router.post('/browse', (req, res) => {
    const hasPaymentHeader =
      req.header('payment-signature') || req.header('x-payment');
    res.setHeader('PAYMENT-REQUIRED', browseChallengeHeader);
    if (hasPaymentHeader) {
      // No facilitator to verify — re-issue 402. Live zero-fee calls
      // activate once creds are added.
      return res.status(402).json({
        ...browseChallenge,
        error: 'OKX facilitator not configured — add credentials to enable verify + settle.',
      });
    }
    return res
      .status(402)
      .json({ ...browseChallenge, error: 'Payment required' });
  });
}

// ── GET /okx/health — facade liveness + mode ─────────────────────────
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    mode: hasOkxCreds ? 'live' : 'self-check',
    network: NETWORK,
    asset: XLAYER_USDT0,
    priceUsd: TRYON_PRICE_USD,
    payTo,
    payToConfigured: payTo !== ZERO_ADDRESS,
    facilitatorConfigured: hasOkxCreds,
    tryOnEndpoint: tryOnResourceUrl(),
  });
});

module.exports = router;
