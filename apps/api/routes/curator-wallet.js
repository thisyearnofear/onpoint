/**
 * Curator Wallet Routes — /api/curator/:slug/wallet/*
 *
 * Self-serve payout wallet provisioning for curators who struggle with
 * private keys. WhatsApp on the curator record is the lightweight auth
 * factor until full curator login ships.
 *
 * POST /api/curator/:slug/wallet/provision  — platform custodial wallet
 * POST /api/curator/:slug/wallet/migrate    — sweep + claim own address
 * GET  /api/curator/:slug/wallet/status     — public payout status
 */

const express = require('express');
const { eq } = require('drizzle-orm');
const { curators } = require('@repo/db');
const logger = require('../lib/logger');
const { getDb } = require('../lib/db');
const { isValidSlug } = require('../lib/slugs');
const {
  generateCustodialWallet,
  buildCommerceWithCustodialWallet,
  buildCommerceWithCuratorOwnedWallet,
  sweepCustodialWallet,
  isValidAddress,
  hasCustodialWallet,
} = require('../lib/curator-payout-wallets');

const router = express.Router({ mergeParams: true });

function normalizePhone(value) {
  return String(value || '').replace(/\s/g, '').trim();
}

function verifyCuratorWhatsapp(curator, whatsapp) {
  const stored = normalizePhone(curator.channels?.whatsapp);
  const provided = normalizePhone(whatsapp);
  if (!stored || !provided) return false;
  return stored === provided;
}

function publicWalletStatus(curator) {
  const commerce = curator.commerce || {};
  return {
    slug: curator.slug,
    name: curator.name,
    walletAddress: commerce.walletAddress || null,
    payoutWalletStatus: commerce.payoutWalletStatus || (commerce.walletAddress ? 'curator_owned' : 'unset'),
    payoutWalletProvider: commerce.payoutWalletProvider || null,
    payoutWalletProvisionedAt: commerce.payoutWalletProvisionedAt || null,
    payoutWalletClaimedAt: commerce.payoutWalletClaimedAt || null,
    activatedAt: commerce.activatedAt || null,
    splitAddress: commerce.splitAddress || null,
    agentCommerceHint:
      commerce.walletAddress
        ? 'Wallet configured — agent checkout enabled when live physical stock exists.'
        : 'No payout wallet yet — provision one or paste a MiniPay/Celo address.',
  };
}

router.get('/:slug/wallet/status', async (req, res) => {
  const slug = String(req.params.slug || '').toLowerCase();
  if (!isValidSlug(slug)) {
    return res.status(400).json({ error: 'Invalid curator slug' });
  }

  try {
    const db = getDb({ curators });
    const [curator] = await db.select().from(curators).where(eq(curators.slug, slug)).limit(1);
    if (!curator) return res.status(404).json({ error: 'Curator not found' });
    return res.json(publicWalletStatus(curator));
  } catch (err) {
    logger.error('Failed to load curator wallet status', { component: 'curator-wallet', slug }, err);
    return res.status(500).json({ error: 'Failed to load wallet status' });
  }
});

router.post('/:slug/wallet/provision', async (req, res) => {
  const slug = String(req.params.slug || '').toLowerCase();
  if (!isValidSlug(slug)) {
    return res.status(400).json({ error: 'Invalid curator slug' });
  }

  const whatsapp = req.body?.whatsapp;
  if (!whatsapp) {
    return res.status(400).json({ error: 'whatsapp is required to provision a payout wallet' });
  }

  try {
    const db = getDb({ curators });
    const [curator] = await db.select().from(curators).where(eq(curators.slug, slug)).limit(1);
    if (!curator) return res.status(404).json({ error: 'Curator not found' });

    if (!verifyCuratorWhatsapp(curator, whatsapp)) {
      return res.status(403).json({
        error: 'WhatsApp number does not match this curator profile',
      });
    }

    if (curator.commerce?.walletAddress && curator.commerce?.payoutWalletStatus === 'curator_owned') {
      return res.status(409).json({
        error: 'Curator already has their own payout wallet',
        ...publicWalletStatus(curator),
      });
    }

    const { address, alreadyExisted } = generateCustodialWallet(slug);
    const nextCommerce = buildCommerceWithCustodialWallet(curator.commerce, address);
    // Mark as activated — curator explicitly provisioned via self-serve
    nextCommerce.activatedAt = nextCommerce.activatedAt || new Date().toISOString();

    const [updated] = await db
      .update(curators)
      .set({ commerce: nextCommerce })
      .where(eq(curators.slug, slug))
      .returning();

    logger.info('Curator custodial wallet provisioned', {
      component: 'curator-wallet',
      slug,
      address,
      alreadyExisted,
    });

    return res.status(alreadyExisted ? 200 : 201).json({
      success: true,
      alreadyExisted,
      message:
        'Payout wallet ready. OnPoint holds agent earnings here until you connect MiniPay or your own Celo wallet.',
      ...publicWalletStatus(updated),
    });
  } catch (err) {
    logger.error('Failed to provision curator wallet', { component: 'curator-wallet', slug }, err);
    return res.status(500).json({ error: err.message || 'Failed to provision wallet' });
  }
});

router.post('/:slug/wallet/migrate', async (req, res) => {
  const slug = String(req.params.slug || '').toLowerCase();
  if (!isValidSlug(slug)) {
    return res.status(400).json({ error: 'Invalid curator slug' });
  }

  const whatsapp = req.body?.whatsapp;
  const newWalletAddress = String(req.body?.newWalletAddress || '').trim();
  const providerRaw = String(req.body?.provider || 'manual').trim();
  const provider = ['magic', 'minipay', 'manual'].includes(providerRaw) ? providerRaw : 'manual';

  if (!whatsapp) {
    return res.status(400).json({ error: 'whatsapp is required' });
  }
  if (!isValidAddress(newWalletAddress)) {
    return res.status(400).json({
      error: 'newWalletAddress must be a valid 0x address (40 hex chars)',
    });
  }

  try {
    const db = getDb({ curators });
    const [curator] = await db.select().from(curators).where(eq(curators.slug, slug)).limit(1);
    if (!curator) return res.status(404).json({ error: 'Curator not found' });

    if (!verifyCuratorWhatsapp(curator, whatsapp)) {
      return res.status(403).json({
        error: 'WhatsApp number does not match this curator profile',
      });
    }

    const status = curator.commerce?.payoutWalletStatus
      || (curator.commerce?.walletAddress ? 'curator_owned' : 'unset');

    let sweep = { txHash: null, amountWei: '0', skipped: true };
    if (status === 'platform_custodial' && hasCustodialWallet(slug)) {
      sweep = await sweepCustodialWallet(slug, newWalletAddress);
    }

    const nextCommerce = buildCommerceWithCuratorOwnedWallet(
      curator.commerce,
      newWalletAddress,
      provider,
    );
    const [updated] = await db
      .update(curators)
      .set({ commerce: nextCommerce })
      .where(eq(curators.slug, slug))
      .returning();

    logger.info('Curator payout wallet migrated', {
      component: 'curator-wallet',
      slug,
      newWalletAddress,
      sweepTxHash: sweep.txHash,
      sweptWei: sweep.amountWei,
    });

    return res.json({
      success: true,
      message:
        sweep.skipped
          ? 'Payout wallet updated. Ask OnPoint ops to enable 0xSplit once you are ready for agent sales.'
          : 'Balance swept to your wallet. Payout address updated.',
      sweep,
      setupSplitHint: `POST /api/admin/curators/${slug}/setup-split after verifying the new wallet`,
      ...publicWalletStatus(updated),
    });
  } catch (err) {
    logger.error('Failed to migrate curator wallet', { component: 'curator-wallet', slug }, err);
    return res.status(500).json({ error: err.message || 'Failed to migrate wallet' });
  }
});

module.exports = router;
