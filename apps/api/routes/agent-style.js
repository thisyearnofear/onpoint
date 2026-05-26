/**
 * Agent Style Route — /api/agent/style
 *
 * Track user style interactions and get personalized recommendations.
 * Uses stored style preferences from agent-controls middleware.
 *
 * Ported from apps/web/app/api/agent/style/route.ts
 *
 * Auth: SERVICE_API_KEY + forwarded user context (GET requires auth)
 */

const express = require('express');
const router = express.Router();
const agentCore = require('@repo/agent-core');
const sharedTypes = require('@onpoint/shared-types');
const logger = require('../lib/logger');
const { forwardedUser } = require('../middleware/forwarded-user');

router.use(forwardedUser);

// POST /api/agent/style — Track a style interaction
router.post('/', async (req, res) => {
  const { userId, category, price, sessionGoal } = req.body;
  const effectiveUserId = userId || req.userContext.userId || 'anonymous';

  if (!category || typeof price !== 'number') {
    return res.status(400).json({ error: 'category (string) and price (number) are required' });
  }

  try {
    await agentCore.AgentControls.initStore('onpoint-stylist', effectiveUserId);
    agentCore.AgentControls.trackStyleInteraction(effectiveUserId, { category, price });

    // Seed style preferences based on session goal for first-time users
    if (sessionGoal) {
      const prefs = agentCore.AgentControls.getStylePreferences(effectiveUserId);
      if (!prefs.categories.length && !prefs.colors.length) {
        const goalSeeds = {
          event: { categories: ['dress', 'jacket', 'accessory'], colors: ['black', 'navy', 'burgundy', 'gold'] },
          daily: { categories: ['shirt', 'denim', 'sneaker'], colors: ['white', 'blue', 'gray', 'beige'] },
          critique: { categories: ['shirt', 'trouser'], colors: ['neutral'] },
        };
        if (goalSeeds[sessionGoal]) {
          agentCore.AgentControls.trackStyleInteraction(effectiveUserId, {
            category: goalSeeds[sessionGoal].categories[0],
            price: 50,
          });
        }
      }
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Style track error', { component: 'style' }, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/agent/style — Get personalized recommendations
router.get('/', async (req, res) => {
  const userId = req.userContext.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required for style recommendations' });
  }

  const limit = parseInt(req.query.limit) || 3;
  const excludeParam = req.query.excludeIds || '';
  const excludeIds = excludeParam ? excludeParam.split(',') : [];

  try {
    await agentCore.AgentControls.initStore('onpoint-stylist', userId);

    const prefs = agentCore.AgentControls.getStylePreferences(userId);
    const stylePrefs = {
      categories: prefs.categories,
      priceRange: prefs.priceRange,
      colors: prefs.colors,
    };

    const recommendations = sharedTypes.getRecommendedItems(stylePrefs, limit, excludeIds);

    res.json({
      recommendations: recommendations.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        category: item.category,
        cover: item.cover,
        averageRating: item.averageRating,
      })),
      preferences: stylePrefs,
    });
  } catch (error) {
    logger.error('Style recommend error', { component: 'style' }, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
