/**
 * Agent Try-On Route — /api/agent/try-on
 *
 * The fitting room as a paid capability for external agents. An agent
 * submits its human's photo plus a curator listing and gets back a
 * try-on render and a structured fit signal — so it can answer "will
 * this suit my human?" BEFORE spending on the item.
 *
 * x402 flow (same pattern as POST /api/curator/:slug/order):
 *   1. POST {curatorSlug, listingId, photoData}        → 402 + requirements
 *   2. Agent transfers the cUSD fee to payTo on Celo
 *   3. Re-POST with {paymentTxHash}                    → verify on-chain,
 *      claim tx in the payments ledger, run the try-on  → 200 + render/fit
 *
 * Revenue routing mirrors orders: if the curator has a 0xSplits SplitV2,
 * the fee goes to the Split (curator earns their share of every try-on of
 * their catalog); otherwise it goes to the platform wallet.
 *
 * Auth: none (public, agent-facing) — payment IS the auth.
 */

const express = require('express');
const { neon } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-http');
const { eq, and, ne, sql, inArray } = require('drizzle-orm');
const { curators, listings, kitSkus, payments } = require('@repo/db');
const sharedTypes = require('@onpoint/shared-types');
const agentCore = require('@repo/agent-core');
const logger = require('../lib/logger');
const { curatorSplitAddress, tryOnPriceCusd, storefrontWebUrl, polaroidWebUrl, webBaseUrl, buildRevenueHint } = require('../lib/agent-commerce');
const { getAttributionSuffix, getAttributionCode, getAssignedTag } = require('../lib/attribution');
const x402Facilitator = require('../lib/x402-facilitator');
const { engine } = require('./ai-virtual-tryon');
const { upload: r2Upload, publicUrl: r2PublicUrl, keyFor: r2KeyFor } = require('@repo/storage');

const router = express.Router();

const CONNECTION_STRING = process.env.NEON_DATABASE_URL;
let _sql = null;
let _db = null;

function getDb() {
  if (!_db) {
    if (!CONNECTION_STRING) throw new Error('NEON_DATABASE_URL not configured');
    _sql = neon(CONNECTION_STRING);
    _db = drizzle(_sql, { schema: { curators, listings, kitSkus, payments } });
  }
  return _db;
}

/** Raw neon SQL tagged template — for queries that drizzle can't express */
function rawSql(strings, ...values) {
  if (!_sql) {
    if (!CONNECTION_STRING) throw new Error('NEON_DATABASE_URL not configured');
    _sql = neon(CONNECTION_STRING);
  }
  return _sql(strings, ...values);
}

function r2KeyToUrl(key) {
  if (!key) return null;
  // Full URLs (https://, ipfs://) pass through as-is — used for digital listings
  if (/^(https?:|ipfs:)/.test(key)) return key;
  const base = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');
  if (!base) return null;
  return `${base}/${String(key).replace(/^\/+/, '')}`;
}

/** Person photo must be an inline data URI — agents send it directly. */
function isValidPhotoData(value) {
  return (
    typeof value === 'string' &&
    /^data:image\/(png|jpe?g|webp);base64,/.test(value) &&
    value.length < 8_000_000 // ~6MB image
  );
}

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];

/**
 * Map the vision model's coarse chest/build reading onto the listing's
 * actually-stocked sizes. Deterministic and honest about uncertainty:
 * returns null rather than guessing when the analysis gives nothing.
 */
function recommendSize(bodyAnalysis, sizes) {
  const inStock = (Array.isArray(sizes) ? sizes : [])
    .filter((entry) => Number(entry.stock) > 0)
    .map((entry) => String(entry.size).toUpperCase());
  if (inStock.length === 0) return null;

  const chest = bodyAnalysis?.measurements?.chest;
  const bodyType = bodyAnalysis?.bodyType;
  let ideal;
  if (chest === 'small') ideal = 'S';
  else if (chest === 'large') ideal = bodyType === 'plus-size' ? 'XL' : 'L';
  else if (chest === 'medium') ideal = 'M';
  else if (bodyType === 'slim') ideal = 'S';
  else if (bodyType === 'plus-size') ideal = 'XL';
  else return null;

  if (inStock.includes(ideal)) return ideal;
  // Nearest stocked size by distance in the size ladder
  const idealIdx = SIZE_ORDER.indexOf(ideal);
  const ranked = inStock
    .filter((s) => SIZE_ORDER.includes(s))
    .sort(
      (a, b) =>
        Math.abs(SIZE_ORDER.indexOf(a) - idealIdx) -
        Math.abs(SIZE_ORDER.indexOf(b) - idealIdx),
    );
  return ranked[0] || null;
}

// ── POST /api/agent/try-on ───────────────────────────────────
router.post('/', async (req, res) => {
  const { curatorSlug, listingId, photoData, personDescription, paymentTxHash, lookSlug } =
    req.body || {};
  const slug = String(curatorSlug || '').toLowerCase();

  if (!/^[a-z0-9-]{2,48}$/.test(slug)) {
    return res.status(400).json({ error: 'curatorSlug is required (valid slug)' });
  }
  if (!listingId || typeof listingId !== 'string') {
    return res.status(400).json({ error: 'listingId is required' });
  }
  if (!isValidPhotoData(photoData)) {
    return res.status(400).json({
      error: 'photoData must be a base64 data URI (image/png, image/jpeg, or image/webp, under ~6MB)',
    });
  }
  if (paymentTxHash !== undefined && !/^0x[0-9a-fA-F]{64}$/.test(String(paymentTxHash))) {
    return res.status(400).json({ error: 'paymentTxHash must be a 0x-prefixed 32-byte hash' });
  }

  let db;
  try {
    db = getDb();
  } catch (err) {
    logger.error('NEON_DATABASE_URL not configured', { component: 'agent-tryon' });
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    // leftJoin kitSkus — digital listings have no SKU
    const [row] = await db
      .select({ listing: listings, curator: curators, kit: kitSkus })
      .from(listings)
      .innerJoin(curators, eq(listings.curatorSlug, curators.slug))
      .leftJoin(kitSkus, eq(listings.skuId, kitSkus.id))
      .where(eq(listings.id, listingId))
      .limit(1);

    if (!row || row.curator.slug !== slug) {
      return res.status(404).json({ error: 'Listing not found for this curator' });
    }

    const isDigital = row.listing.inventoryType === 'digital';
    const garmentUrl = r2KeyToUrl(
      row.listing.photoKeys?.[0] || row.kit?.officialImageKey,
    );
    if (!garmentUrl) {
      return res.status(409).json({ error: 'Listing has no garment image to try on' });
    }

    const itemLabel = isDigital
      ? row.listing.title || 'Digital garment'
      : `${row.kit.club} ${row.kit.kitType} kit (${row.kit.season})`;
    const priceCusd = tryOnPriceCusd(row.curator);
    const splitAddress = curatorSplitAddress(row.curator);
    const payTo = splitAddress || agentCore.PLATFORM_WALLET;
    const resourceUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const requirements = sharedTypes.buildPaymentRequirements(
      priceCusd,
      payTo,
      resourceUrl,
      `OnPoint try-on: ${itemLabel} from ${row.curator.name}`,
    );

    // Build facilitator-compatible requirements (USDC via Celo x402 facilitator).
    // The facilitator settles EIP-3009 transferWithAuthorization on-chain
    // (gasless for the buyer) and counts toward the Most x402 Payments track.
    const facilitatorRequirements = x402Facilitator.buildFacilitatorRequirements(
      priceCusd,
      payTo,
      resourceUrl,
      `OnPoint try-on: ${itemLabel} from ${row.curator.name}`,
    );

    // ── Check for x402 facilitator payment (X-PAYMENT header) ──
    const xPaymentHeader = req.headers['x-payment'];

    // ── Step 1: no payment proof → 402 challenge ──
    if (!paymentTxHash && !xPaymentHeader) {
      return res.status(402).json({
        ...sharedTypes.build402Body([requirements]),
        // Facilitator path: USDC via Celo x402 facilitator (x402 v2)
        x402: {
          x402Version: 2,
          accepts: [facilitatorRequirements],
          facilitatorUrl: x402Facilitator.FACILITATOR_URL,
          instructions: 'Sign an EIP-3009 transferWithAuthorization for USDC and send it in the X-PAYMENT header. The facilitator settles on-chain (gasless for buyer).',
        },
        quote: {
          purpose: 'try_on',
          curatorSlug: slug,
          listingId,
          item: itemLabel,
          priceCusd,
          payTo,
          payoutModel: splitAddress ? '0xSplits (curator earns a share)' : 'platform',
          token: sharedTypes.X402_ASSET,
          chainId: sharedTypes.X402_CHAIN_ID,
          attribution: {
            code: getAttributionCode(),
            assignedTag: getAssignedTag(),
            dataSuffix: getAttributionSuffix(),
            instructions: 'Append the dataSuffix to your transfer transaction data to tag it as OnPoint activity on Celo.',
          },
          instructions:
            'Two payment paths: (1) cUSD — transfer to payTo, re-POST with paymentTxHash. (2) USDC via x402 facilitator — sign EIP-3009 auth, send in X-PAYMENT header.',
        },
        revenueHint: buildRevenueHint('try_on', { totalCusd: priceCusd, curator: row.curator }),
      });
    }

    // ── Step 2a: facilitator payment (X-PAYMENT header) ──
    let settlementTxHash = null;
    let payerAddress = null;
    let verification = null;
    if (xPaymentHeader) {
      const result = await x402Facilitator.processFacilitatorPayment(
        xPaymentHeader,
        facilitatorRequirements,
      );
      if (!result.success) {
        return res.status(402).json({
          error: `Facilitator payment failed: ${result.error}`,
          ...sharedTypes.build402Body([requirements]),
          x402: {
            x402Version: 2,
            accepts: [facilitatorRequirements],
            facilitatorUrl: x402Facilitator.FACILITATOR_URL,
          },
        });
      }
      settlementTxHash = result.txHash;
      // The facilitator settled on-chain; we don't have the payer's address
      // from the facilitator response, but the tx hash is the proof.
      payerAddress = '0x0000000000000000000000000000000000000000'; // facilitator-settled
    } else {
      // ── Step 2b: verify cUSD payment, run try-on, then claim ──
    const minAmountWei = BigInt(requirements.maxAmountRequired);
    verification = await agentCore.ERC20.verifyTransfer({
      chain: 'celo',
      tokenAddress: sharedTypes.X402_ASSET,
      txHash: paymentTxHash,
      to: payTo,
      minAmount: minAmountWei,
    });

    if (!verification.verified) {
      return res.status(402).json({
        error: `Payment not verified: ${verification.reason}`,
        ...sharedTypes.build402Body([requirements]),
      });
    }

    // Pre-check: has this payment tx already been claimed?
    const existing = await db
      .select({ id: payments.id })
      .from(payments)
      .where(eq(payments.txHash, paymentTxHash))
      .limit(1);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Payment transaction already used' });
    }
    } // end cUSD verification path

    // The effective tx hash and payer for this request
    const effectiveTxHash = settlementTxHash || paymentTxHash;
    const effectivePayer = settlementTxHash ? payerAddress : (verification?.from || null);

    // Render + fit analysis run concurrently — independent pipelines.
    // We run these BEFORE claiming the payment so that a render failure
    // doesn't burn the agent's payment. The tx is verified but not yet
    // ledgered — if the render fails, the agent can reuse the tx hash
    // for a retry.
    const fitPrompt = `You are an expert fashion stylist. Analyze this person's photo for how a ${itemLabel} would fit and suit them.

Return ONLY valid JSON:
{
  "bodyType": "athletic|slim|average|curvy|plus-size",
  "measurements": { "shoulders": "small|medium|large", "chest": "small|medium|large", "waist": "small|medium|large", "hips": "small|medium|large" },
  "fitRecommendations": ["2-3 specific fit notes for this garment on this person"],
  "styleRecommendations": ["2-3 notes on whether/how this item suits them"],
  "score": 1-10,
  "confidence": 0-1
}`;

    const [render, fitResult] = await Promise.allSettled([
      engine.buildGeneratedOutfitImageResponse({
        data: {
          photoData,
          personDescription: personDescription || '',
          items: [{ name: itemLabel, imageUrl: garmentUrl, description: itemLabel }],
        },
        provider: 'auto',
      }),
      engine
        .generateVisionAnalysis({ prompt: fitPrompt, imageBase64: photoData })
        .then(({ text }) => engine.parseBodyAnalysisResponse(text)),
    ]);

    if (render.status === 'rejected') {
      // Render failed — don't claim the payment. The agent can retry
      // with the same tx hash.
      logger.error(
        'Try-on render failed — payment NOT claimed (agent can retry)',
        { component: 'agent-tryon', listingId, txHash: effectiveTxHash },
        render.reason,
      );
      return res.status(502).json({
        error: settlementTxHash
          ? 'Try-on render failed. The facilitator payment was settled on-chain but not ledgered. Contact support.'
          : 'Try-on render failed — your payment was not claimed. You can retry with the same paymentTxHash.',
        retryable: !settlementTxHash,
      });
    }

    // Render succeeded — now atomically claim the payment.
    const claimed = await db
      .insert(payments)
      .values({
        purpose: 'try_on',
        curatorSlug: slug,
        payerAddress: effectivePayer,
        amountCusd: priceCusd.toFixed(2),
        txHash: effectiveTxHash,
        resource: '/api/agent/try-on',
        metadata: { listingId, item: itemLabel, payTo, splitAddress: splitAddress || null, paymentMethod: settlementTxHash ? 'x402_facilitator' : 'cusd' },
      })
      .onConflictDoNothing({ target: payments.txHash })
      .returning({ id: payments.id });

    if (claimed.length === 0) {
      // Race: another request claimed this tx between our pre-check and
      // the render. The render is done but the payment is already used.
      // Return the render anyway — the agent got value.
      logger.warn('Try-on payment claimed by concurrent request during render', {
        component: 'agent-tryon', txHash: effectiveTxHash, listingId,
      });
      return res.status(409).json({
        error: 'Payment transaction already used by a concurrent request',
        render: { image: render.value.generatedImage, provider: render.value.provider },
      });
    }
    const paymentId = claimed[0].id;

    const fit = fitResult.status === 'fulfilled' ? fitResult.value : null;
    const fitSignal = fit
      ? {
          bodyType: fit.bodyType || null,
          measurements: fit.measurements || null,
          fitRecommendations: fit.fitRecommendations || [],
          styleRecommendations: fit.styleRecommendations || [],
          score: fit.score ?? null,
          confidence: fit.confidence ?? null,
          recommendedSize: recommendSize(fit, row.listing.sizes),
        }
      : null;

    // Verifiable receipt anchored to the payer's own transaction
    let receiptId = null;
    try {
      const receipt = await agentCore.recordReceipt({
        action: 'analyze_outfit',
        sessionId: `tryon_${paymentId}`,
        metadata: {
          purpose: 'try_on',
          curatorSlug: slug,
          listingId,
          item: itemLabel,
          priceCusd,
          payerAddress: effectivePayer,
          renderProvider: render.value.provider,
          paymentMethod: settlementTxHash ? 'x402_facilitator' : 'cusd',
        },
        txHash: effectiveTxHash,
        chain: 'celo',
      });
      receiptId = receipt.id;
    } catch (receiptErr) {
      logger.warn('Failed to record try-on receipt', { component: 'agent-tryon', paymentId }, receiptErr);
    }

    const { classifyAgentCaller, recordAgentDemand } = require('../lib/agent-demand');
    const caller = classifyAgentCaller(effectivePayer);
    recordAgentDemand('try_on', caller, 'succeeded');

    logger.info('Agent try-on served', {
      component: 'agent-tryon',
      paymentId,
      slug,
      listingId,
      provider: render.value.provider,
      isDigital,
      caller,
      payerAddress: effectivePayer,
      paymentMethod: settlementTxHash ? 'x402_facilitator' : 'cusd',
    });

    // For digital listings, find similar physical items from human curators
    // to bridge the digital→physical funnel. Match by tag overlap.
    let similarPhysicalItems = [];
    if (isDigital && row.listing.tags?.length > 0) {
      try {
        const tags = row.listing.tags;
        // Query physical listings from human curators that share tags.
        const matches = await rawSql`
          SELECT l.id, l.curator_slug, l.title, l.photo_keys, l.sizes,
                 c.name AS curator_name
          FROM listings l
          INNER JOIN curators c ON l.curator_slug = c.slug
          WHERE l.inventory_type = 'physical'
            AND l.status = 'live'
            AND c.type = 'human'
            AND l.curator_slug != ${slug}
            AND l.tags && ${tags}
          LIMIT 5
        `;

        similarPhysicalItems = matches.map((m) => ({
          listingId: m.id,
          curatorSlug: m.curator_slug,
          curatorName: m.curator_name,
          title: m.title || `${m.curator_name} listing`,
          imageUrl: r2KeyToUrl(m.photo_keys?.[0]),
          orderUrl: `/api/curator/${m.curator_slug}/order`,
          storefrontUrl: `/api/curator/${m.curator_slug}/storefront`,
          webUrl: storefrontWebUrl(m.curator_slug),
        }));
      } catch (matchErr) {
        logger.warn('Failed to find similar physical items', { component: 'agent-tryon', listingId }, matchErr);
      }
    }

    const nextHint = isDigital
      ? similarPhysicalItems.length > 0
        ? `This is a digital design by ${row.curator.name}. Want the real thing? Check similarPhysicalItems for physical listings from human curators, then POST the order endpoint.`
        : `This is a digital design by ${row.curator.name}. Browse the directory for human curators with similar items.`
      : 'Happy with the fit? POST the order endpoint with {listingId, size, quantity} to buy.';

    // ── Persist polaroid to R2 for a shareable web URL ──
    //
    // Best-effort: if the upload fails, the try-on still succeeded.
    // The agent gets the render inline; the polaroid URL is a bonus.
    let polaroid = null;
    try {
      const imageData = render.value.generatedImage;
      // Strip data-URL prefix to get raw base64
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');
      const imageKey = r2KeyFor.agentPolaroid(String(paymentId));
      await r2Upload(imageKey, imageBuffer, 'image/jpeg');
      const imageUrl = r2PublicUrl(imageKey);

      const meta = {
        item: itemLabel,
        curatorSlug: slug,
        curatorName: row.curator.name,
        listingId,
        inventoryType: row.listing.inventoryType,
        imageUrl,
        fitSignal,
        stylingTips: render.value.stylingTips || [],
        payment: {
          txHash: effectiveTxHash,
          amountCusd: priceCusd.toFixed(2),
          explorerUrl: agentCore.getExplorerUrl('celo', effectiveTxHash),
        },
        storefrontUrl: storefrontWebUrl(slug),
        createdAt: new Date().toISOString(),
      };
      const metaKey = r2KeyFor.agentPolaroidMeta(String(paymentId));
      await r2Upload(metaKey, Buffer.from(JSON.stringify(meta), 'utf-8'), 'application/json');

      polaroid = {
        imageUrl,
        webUrl: polaroidWebUrl(String(paymentId)),
      };
    } catch (polaroidErr) {
      logger.warn('Polaroid upload failed — try-on still succeeded', { component: 'agent-tryon', paymentId }, polaroidErr);
    }

    // ── Share card: if this try-on came from a look, generate a collage ──
    let shareCard = null;
    if (lookSlug) {
      try {
        const { generateShareCard } = require('../lib/share-card');
        const { neon } = require('@neondatabase/serverless');
        const { drizzle } = require('drizzle-orm/neon-http');
        const { eq: eqD } = require('drizzle-orm');
        const { agentLooks, listings: listingsTable, kitSkus: kitTable } = require('@repo/db');

        const dbLook = drizzle(neon(process.env.NEON_DATABASE_URL));
        const [look] = await dbLook
          .select()
          .from(agentLooks)
          .where(eqD(agentLooks.slug, lookSlug))
          .limit(1);

        if (look && look.status === 'live') {
          // Resolve look items for the collage
          const lookItems = await dbLook
            .select({ listing: listingsTable, kit: kitTable })
            .from(listingsTable)
            .leftJoin(kitTable, eqD(listingsTable.skuId, kitTable.id))
            .where(inArray(listingsTable.id, look.listingIds));

          const { R2Storage } = require('@repo/storage');
          const r2 = new R2Storage({
            accountId: process.env.R2_ACCOUNT_ID,
            accessKeyId: process.env.R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
            bucketName: process.env.R2_BUCKET_NAME,
            publicUrl: process.env.R2_PUBLIC_URL || '',
          });

          const itemsForCard = look.listingIds.map((id) => {
            const row = lookItems.find((r) => r.listing.id === id);
            if (!row) return null;
            const photoKey = row.listing.photoKeys?.[0] || row.listing.officialImageKey;
            return {
              title: row.listing.title || (row.kit ? `${row.kit.club} ${row.kit.kitType}` : 'Item'),
              imageUrl: photoKey ? r2.publicUrl(photoKey) : null,
              isHero: row.listing.id === look.heroListingId,
            };
          }).filter(Boolean);

          const cardResult = await generateShareCard({
            tryOnImageBase64: render.value.generatedImage,
            items: itemsForCard,
            agentAddress: look.agentAddress,
            lookSlug: look.slug,
            lookTitle: look.title,
          });

          shareCard = {
            imageUrl: cardResult.url,
            r2Key: cardResult.r2Key,
            lookSlug: look.slug,
            lookUrl: `${webBaseUrl()}/look/${look.slug}`,
          };

          // Increment try-on count
          await dbLook.execute(sql`UPDATE agent_looks SET try_on_count = try_on_count + 1, updated_at = now() WHERE slug = ${lookSlug}`);

          logger.info('Share card generated for look', {
            component: 'agent-tryon',
            lookSlug,
            r2Key: cardResult.r2Key,
          });
        }
      } catch (cardErr) {
        logger.warn('Share card generation failed — try-on still succeeded', {
          component: 'agent-tryon', lookSlug,
        }, cardErr);
      }
    }

    const storefrontWeb = storefrontWebUrl(slug);

    return res.status(200).json({
      success: true,
      tryOn: {
        item: itemLabel,
        curatorSlug: slug,
        listingId,
        inventoryType: row.listing.inventoryType,
        render: {
          image: render.value.generatedImage,
          provider: render.value.provider,
          imageConditioned: render.value.imageConditioned,
        },
        fitSignal,
        stylingTips: render.value.stylingTips || [],
      },
      polaroid,
      ...(shareCard ? { shareCard } : {}),
      payment: {
        id: paymentId,
        txHash: effectiveTxHash,
        amountCusd: priceCusd.toFixed(2),
        explorerUrl: agentCore.getExplorerUrl('celo', effectiveTxHash),
        payoutModel: splitAddress ? '0xSplits (curator earns a share)' : 'platform',
        paymentMethod: settlementTxHash ? 'x402_facilitator' : 'cusd',
      },
      receiptId,
      receiptUrl: receiptId ? `${webBaseUrl()}/receipt/${receiptId}` : undefined,
      ...(isDigital ? { similarPhysicalItems } : {}),
      next: isDigital
        ? {
            hint: nextHint,
            directory: '/api/curator/directory',
            webUrl: storefrontWeb,
          }
        : {
            order: `/api/curator/${slug}/order`,
            hint: nextHint,
            webUrl: storefrontWeb,
          },
    });
  } catch (err) {
    logger.error('Agent try-on failed', { component: 'agent-tryon', slug }, err);
    return res.status(500).json({ error: 'Failed to process try-on' });
  }
});

module.exports = router;
module.exports.__test = { isValidPhotoData, recommendSize };
