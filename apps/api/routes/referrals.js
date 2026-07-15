const express = require('express');
const { neon } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-http');
const { orders, agentReferrals } = require('@repo/db');
const { eq, desc } = require('drizzle-orm');

const router = express.Router();

/**
 * POST /api/referrals/capture
 * Capture a referral when an agent shares a link and someone visits
 * Body: { agentAddress, storefrontSlug, source }
 */
router.post('/capture', async (req, res) => {
  try {
    const { agentAddress, storefrontSlug, source } = req.body;
    
    if (!agentAddress || !storefrontSlug) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const db = drizzle(neon(process.env.NEON_DATABASE_URL));
    
    // Check if this agent already has referrals
    const existing = await db
      .select()
      .from(agentReferrals)
      .where(eq(agentReferrals.agentAddress, agentAddress))
      .limit(1);

    // Generate referral code if first time
    const referralCode = existing.length > 0 
      ? existing[0].referralCode 
      : `ref_${agentAddress.slice(2, 10)}`;

    res.json({ 
      success: true, 
      referralCode,
      message: 'Referral captured'
    });
  } catch (error) {
    console.error('Referral capture error:', error);
    res.status(500).json({ error: 'Failed to capture referral' });
  }
});

/**
 * GET /api/referrals/:agentAddress
 * Get referral stats for an agent
 */
router.get('/:agentAddress', async (req, res) => {
  try {
    const { agentAddress } = req.params;
    const db = drizzle(neon(process.env.NEON_DATABASE_URL));

    const referrals = await db
      .select()
      .from(agentReferrals)
      .where(eq(agentReferrals.agentAddress, agentAddress))
      .orderBy(desc(agentReferrals.createdAt))
      .limit(50);

    const stats = {
      totalReferrals: referrals.length,
      totalCommissionCusd: referrals.reduce((sum, r) => sum + parseFloat(r.commissionCusd), 0).toFixed(2),
      pendingCommissionCusd: referrals
        .filter(r => r.status === 'pending')
        .reduce((sum, r) => sum + parseFloat(r.commissionCusd), 0)
        .toFixed(2),
      paidCommissionCusd: referrals
        .filter(r => r.status === 'paid')
        .reduce((sum, r) => sum + parseFloat(r.commissionCusd), 0)
        .toFixed(2),
      recentActivity: referrals.slice(0, 10).map(r => ({
        referralCode: r.referralCode,
        commissionCusd: r.commissionCusd,
        status: r.status,
        orderAmountCusd: r.orderAmountCusd,
        curatorSlug: r.curatorSlug,
        createdAt: r.createdAt,
        payoutTxHash: r.payoutTxHash
      }))
    };

    res.json(stats);
  } catch (error) {
    console.error('Referral stats error:', error);
    res.status(500).json({ error: 'Failed to fetch referral stats' });
  }
});

module.exports = router;
