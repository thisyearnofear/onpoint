/**
 * AI Analyze Person Route
 *
 * Analyzes a person's appearance from a photo for fashion styling purposes.
 * Delegates to the shared provider chain in lib/vision.js — historically
 * Venice-only; the chain keeps the route alive when a single provider fails.
 */

const express = require('express');
const router = express.Router();
const logger = require('../lib/logger');
const vision = require('../lib/vision');

router.post('/', async (req, res) => {
  try {
    const { photoData, stylePreferences } = req.body;

    if (!photoData) {
      return res.status(400).json({ error: 'Photo data is required' });
    }

    if (vision.configuredProviders().length === 0) {
      return res.status(503).json({ error: 'No vision providers are configured' });
    }

    const prefContext = stylePreferences 
      ? `\nUser Preferences to consider:
- Aesthetics: ${stylePreferences.styleAesthetics?.join(', ') || 'Not specified'}
- Budget Tier: ${stylePreferences.budgetTier || 'Not specified'}
- Body Type: ${stylePreferences.bodyType || 'Not specified'}
Tailor your recommendations to align with these preferences.`
      : '';

    const prompt = `Analyze this person's appearance for fashion styling purposes. Describe:
1. Body type and proportions (height estimate, build, body shape)
2. Skin tone and undertones
3. Hair color and style
4. Current outfit style and colors
5. Notable features that would affect clothing recommendations${prefContext}

Provide a detailed but concise description suitable for AI fashion styling.`;

    const result = await vision.completeVision({
      prompt,
      imageDataUrl: photoData,
      expectJson: false,
    });

    return res.json({
      description: result.text,
      type: 'analyze-person',
      provider: result.provider,
      model: result.model,
    });
  } catch (error) {
    logger.error('Person analysis error:', error);
    const unavailable = error.code === 'VISION_UNAVAILABLE';
    return res.status(error.status || (unavailable ? 503 : 500)).json({
      error: unavailable
        ? 'All vision providers failed'
        : error.message || 'Failed to analyze person from photo',
      details: error.stack && process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

module.exports = router;
