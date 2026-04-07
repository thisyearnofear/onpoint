/**
 * Venice Vision Analysis Route
 * 
 * Real-time video frame analysis for Live AR sessions.
 * Uses Venice qwen3-vl-235b-a22b model for vision.
 */

const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

const veniceClient = process.env.VENICE_API_KEY
  ? new OpenAI({
      apiKey: process.env.VENICE_API_KEY,
      baseURL: 'https://api.venice.ai/api/v1',
    })
  : null;

// Goal-aware prompt templates
const PROMPTS_BY_GOAL = {
  event: [
    "Analyze this outfit for a formal event. Focus on elegance, appropriateness, and sophistication.",
    "Evaluate if this look works for a special occasion. Check dress code alignment.",
    "Assess the silhouette and fit for evening wear standards.",
  ],
  daily: [
    "Analyze this everyday outfit. Focus on comfort, coordination, and practicality.",
    "Evaluate this casual look for daily wear. Check color harmony and balance.",
    "Assess the overall aesthetic for everyday style.",
  ],
  critique: [
    "Give an honest critique of this outfit. Be direct about what works and what doesn't.",
    "Analyze this look critically. Point out specific issues and strengths.",
    "Provide blunt fashion feedback. No sugarcoating.",
  ],
};

// Track frame count per session for prompt rotation
const sessionFrameCount = new Map();

router.post('/', async (req, res) => {
  try {
    const { image, goal, systemInstruction } = req.body;

    if (!image || !goal) {
      return res.status(400).json({ error: 'Missing required fields: image, goal' });
    }

    if (!veniceClient) {
      return res.status(503).json({ error: 'Venice AI is temporarily unavailable' });
    }

    // Get prompt for goal with rotation
    const clientId = req.ip || 'default';
    const prompts = PROMPTS_BY_GOAL[goal] || PROMPTS_BY_GOAL.daily;
    const frameCount = (sessionFrameCount.get(clientId) || 0) + 1;
    sessionFrameCount.set(clientId, frameCount);
    const prompt = prompts[(frameCount - 1) % prompts.length] || prompts[0] || "Analyze this outfit.";

    // Strip data URL prefix if present
    const base64Image = image.replace(/^data:image\/\w+;base64,/, '');

    // Call Venice AI with vision model
    const response = await veniceClient.chat.completions.create({
      model: 'qwen3-vl-235b-a22b',
      messages: [
        {
          role: 'system',
          content: systemInstruction || 
            'You are a fashion stylist AI analyzing video frames. Provide concise, actionable styling feedback. Keep responses under 100 words.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    const analysis = response.choices?.[0]?.message?.content || '';

    res.json({
      analysis,
      frameCount,
      model: 'qwen3-vl-235b-a22b',
      provider: 'venice',
    });
  } catch (error) {
    console.error('Venice analyze error:', error);
    res.status(502).json({ error: 'Venice AI analysis failed' });
  }
});

module.exports = router;
