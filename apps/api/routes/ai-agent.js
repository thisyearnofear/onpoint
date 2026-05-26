/**
 * AI Agent Route — /api/ai/agent
 *
 * Provides agent-mediated AI analysis for fashion styling.
 * Accepts a photo and optional style preferences, returns
 * personalized outfit analysis and recommendations.
 *
 * This is the route that was orphaned on the Hetzner server
 * (existed on disk but wasn't mounted in server.js).
 * See ADR 0001 — Phase 1.
 */

const express = require('express');
const router = express.Router();
const logger = require('../lib/logger');

const VENICE_BASE_URL = 'https://api.venice.ai/api/v1';

/**
 * Analyze a person's outfit via Venice Vision API
 */
async function analyzeWithVenice(imageData, preferences = {}) {
  const veniceKey = process.env.VENICE_API_KEY;
  if (!veniceKey) {
    throw new Error('VENICE_API_KEY not configured');
  }

  const prefContext = Object.keys(preferences).length > 0
    ? `\nUser Preferences:
- Aesthetics: ${preferences.styleAesthetics?.join(', ') || 'Not specified'}
- Budget: ${preferences.budgetTier || 'Not specified'}
- Body Type: ${preferences.bodyType || 'Not specified'}
Tailor recommendations accordingly.`
    : '';

  const response = await fetch(`${VENICE_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${veniceKey}`,
    },
    body: JSON.stringify({
      model: 'qwen3-vl-235b-a22b',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are OnPoint, an AI fashion stylist. Analyze this person's appearance and outfit for styling purposes. Provide:

1. **Overall Style Assessment** — Describe their current look
2. **Body & Fit Notes** — Key observations for clothing recommendations
3. **Color Palette Analysis** — What works, what could be enhanced
4. **3 Specific Recommendations** — Actionable fashion suggestions
5. **Styling Score** — Rate 1-10 with brief justification${prefContext}

Keep it concise and actionable.`,
            },
            { type: 'image_url', image_url: { url: imageData } },
          ],
        },
      ],
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`Venice API error ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Generate proactive style suggestions based on user context
 */
async function generateSuggestions(userContext = {}) {
  const veniceKey = process.env.VENICE_API_KEY;
  if (!veniceKey) return [];

  const contextStr = Object.keys(userContext).length > 0
    ? `User context: ${JSON.stringify(userContext)}`
    : 'No specific user context';

  const response = await fetch(`${VENICE_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${veniceKey}`,
    },
    body: JSON.stringify({
      model: 'qwen3-vl-235b-a22b',
      messages: [
        {
          role: 'user',
          content: `You are OnPoint's AI stylist agent. Based on this context, suggest 2-3 fashion actions the agent could take proactively.

${contextStr}

Return a JSON array of suggestions, each with: title (string), description (string), category (one of: outfit, accessory, color, trend, event), confidence (0-100).

Return ONLY valid JSON, no markdown.`,
        },
      ],
      max_tokens: 512,
    }),
  });

  if (!response.ok) return [];

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '[]';
  const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    const suggestions = JSON.parse(cleaned);
    return Array.isArray(suggestions) ? suggestions.slice(0, 3) : [];
  } catch {
    return [];
  }
}

// POST /api/ai/agent — Analyze outfit with optional preferences
router.post('/', async (req, res) => {
  try {
    const { imageData, stylePreferences, mode = 'analyze' } = req.body;

    if (!imageData && mode !== 'suggest') {
      return res.status(400).json({ error: 'imageData is required for analysis mode' });
    }

    switch (mode) {
      case 'analyze': {
        const analysis = await analyzeWithVenice(imageData, stylePreferences);
        return res.json({
          success: true,
          analysis,
          type: 'ai-agent-analysis',
          mode: 'analyze',
        });
      }

      case 'suggest': {
        const suggestions = await generateSuggestions(stylePreferences);
        return res.json({
          success: true,
          suggestions,
          type: 'ai-agent-suggestions',
          mode: 'suggest',
        });
      }

      default:
        return res.status(400).json({ error: `Unknown mode: ${mode}. Use 'analyze' or 'suggest'.` });
    }
  } catch (error) {
    logger.error('AI agent analysis failed', { component: 'ai-agent' }, error);
    return res.status(error.status || 500).json({
      error: error.message || 'AI agent analysis failed',
    });
  }
});

module.exports = router;
