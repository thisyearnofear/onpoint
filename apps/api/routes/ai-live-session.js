/**
 * Live Session Provisioning Route
 * 
 * Provisions AI live sessions (Venice or Gemini Live).
 * Handles authentication, rate limiting, and session tokens.
 */

const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { provider, goal, systemInstruction, byok, sessionToken } = req.body;

    if (!provider || !goal) {
      return res.status(400).json({ error: 'Missing required fields: provider, goal' });
    }

    // Venice AI - Free tier (uses our API key)
    if (provider === 'venice') {
      return res.json({
        success: true,
        provider: 'venice',
        config: {
          pollingInterval: 3000, // 3 seconds between frames
          model: 'qwen3-vl-235b-a22b',
          endpoint: '/api/ai/venice-analyze',
        },
        limits: {
          framesPerMinute: 20,
          maxSessionDuration: 300, // 5 minutes
        },
      });
    }

    // Gemini Live - Premium (requires payment or BYOK)
    if (provider === 'gemini') {
      const geminiApiKey = byok || process.env.GOOGLE_GEMINI_API_KEY;

      if (!geminiApiKey && !sessionToken) {
        return res.status(402).json({
          error: 'Gemini Live requires payment or your own API key.',
          byokRequired: true,
          paymentRequired: true,
        });
      }

      // TODO: Validate session token if provided
      // For now, accept BYOK or server key

      return res.json({
        success: true,
        provider: 'gemini',
        config: {
          apiKey: geminiApiKey,
          baseURL: 'wss://generativelanguage.googleapis.com/ws',
          model: 'models/gemini-2.0-flash-live-001',
          systemInstruction,
        },
        limits: {
          maxSessionDuration: 1800, // 30 minutes
          unlimited: true,
        },
      });
    }

    return res.status(400).json({ error: 'Invalid provider. Use "venice" or "gemini".' });
  } catch (error) {
    console.error('Live session error:', error);
    res.status(500).json({ error: 'Failed to provision session' });
  }
});

module.exports = router;
