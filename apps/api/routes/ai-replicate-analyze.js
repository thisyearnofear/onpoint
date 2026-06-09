/**
 * Replicate Vision Analysis Route
 *
 * Server-side proxy that calls GPT-4o-mini via the Replicate API.
 * Keeps REPLICATE_API_TOKEN secure (never reaches the browser).
 *
 * Architecture:
 *   Browser → Hetzner Express → Replicate API (GPT-4o-mini) → Response
 */

const express = require('express');
const router = express.Router();
const logger = require('../lib/logger');

const REPLICATE_API_BASE = 'https://api.replicate.com/v1';
const MAX_POLL_ATTEMPTS = 10;
const POLL_INTERVAL_MS = 1000;

/**
 * Build a fashion analysis prompt based on goal and optional persona.
 */
function buildFashionPrompt(goal, persona) {
  const goalContext = {
    daily:
      'Analyze this outfit for a daily look. Assess fit, color coordination, proportion, and overall aesthetic. Provide specific, actionable feedback.',
    event:
      'Analyze this outfit for an event or special occasion. Assess formality, silhouette, polish, and whether it suits an elevated setting.',
    critique:
      "Give an honest, direct critique of this outfit. Identify what's working, what isn't, and what should change first. Be specific and candid.",
  };

  const prompt = goalContext[goal] || goalContext.daily;

  if (persona) {
    return `You are a professional fashion stylist with a distinct personality. ${prompt}

Consider the wearer's personal style and provide advice in a way that matches your persona. Be authentic while delivering valuable fashion feedback.

Provide:
1. Overall impression
2. Fit assessment
3. Color and palette analysis
4. Specific strengths
5. Specific areas for improvement
6. A clear next-move recommendation`;
  }

  return `You are a professional fashion stylist. ${prompt}

Provide:
1. Overall impression
2. Fit assessment
3. Color and palette analysis
4. Specific strengths
5. Specific areas for improvement
6. A clear next-move recommendation`;
}

/**
 * Extract the analysis text from a Replicate prediction result.
 */
function extractOutput(result) {
  const output = result.output;
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) return output.join('');
  if (output && typeof output === 'object') return JSON.stringify(output);
  return '';
}

/**
 * Poll an async Replicate prediction URL until completion or timeout.
 */
async function pollPrediction(getUrl, apiToken) {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const pollResponse = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });

    if (!pollResponse.ok) break;

    const pollResult = await pollResponse.json();

    if (pollResult.status === 'succeeded') {
      return extractOutput(pollResult);
    }

    if (pollResult.status === 'failed') {
      logger.error('Replicate prediction failed', {
        component: 'replicate-analyze',
      }, new Error(pollResult.error || 'Prediction failed'));
      return null;
    }
  }

  logger.error('Replicate prediction polling timed out', {
    component: 'replicate-analyze',
  });
  return null;
}

router.post('/', async (req, res) => {
  try {
    const { image, goal, persona } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'Image is required' });
    }

    const apiToken = process.env.REPLICATE_API_TOKEN;
    if (!apiToken) {
      return res.status(503).json({ error: 'Replicate API token not configured' });
    }

    const sessionGoal = goal || 'daily';

    // Call Replicate's prediction endpoint for GPT-4o-mini
    const replicateResponse = await fetch(
      `${REPLICATE_API_BASE}/models/openai/gpt-4o-mini/predictions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
          Prefer: 'wait',
        },
        body: JSON.stringify({
          input: {
            prompt: buildFashionPrompt(sessionGoal, persona),
            image_input: image,
            system_prompt:
              'You are a professional fashion stylist and critic with expertise in fit, color theory, fabric, and occasion dressing.',
            max_completion_tokens: 2000,
            temperature: 0.7,
          },
        }),
      },
    );

    if (!replicateResponse.ok) {
      const errorText = await replicateResponse.text().catch(() => '');
      logger.error('Replicate API error', {
        component: 'replicate-analyze',
        status: replicateResponse.status,
      }, new Error(errorText || replicateResponse.statusText));

      if (replicateResponse.status === 429) {
        return res.status(429).json({
          error: 'Replicate API rate limit exceeded. Please wait and try again.',
        });
      }

      return res.status(replicateResponse.status).json({
        error: `Replicate analysis failed: ${errorText || replicateResponse.statusText}`,
      });
    }

    const result = await replicateResponse.json();

    // Handle async prediction (202 with polling URL)
    const urlsObj = result.urls;
    const pollUrl =
      urlsObj && typeof urlsObj === 'object'
        ? urlsObj.get
        : undefined;

    if (replicateResponse.status === 202 && typeof pollUrl === 'string') {
      const output = await pollPrediction(pollUrl, apiToken);

      if (!output) {
        return res.status(504).json({
          error: 'AI analysis timed out. Please try again.',
        });
      }

      return res.json({ analysis: output, model: 'gpt-4o-mini' });
    }

    // Extract the output from the completed prediction
    const analysis = extractOutput(result);

    if (!analysis) {
      return res.status(502).json({ error: 'Empty response from Replicate' });
    }

    res.json({ analysis, model: 'gpt-4o-mini' });
  } catch (error) {
    logger.error('Replicate request error', {
      component: 'replicate-analyze',
    }, error);
    res.status(502).json({
      error: `Replicate request failed: ${error.message || 'Unknown error'}`,
    });
  }
});

module.exports = router;
