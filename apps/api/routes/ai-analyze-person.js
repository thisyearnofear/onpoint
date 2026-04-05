/**
 * AI Analyze Person Route
 *
 * Uses Venice Vision API to analyze a person's appearance from a photo
 * for fashion styling purposes.
 */

const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

const VENICE_BASE_URL = 'https://api.venice.ai/api/v1';
const veniceKey = process.env.VENICE_API_KEY || null;
const veniceClient = veniceKey
  ? new OpenAI({ apiKey: veniceKey, baseURL: VENICE_BASE_URL })
  : null;

router.post('/', async (req, res) => {
  try {
    const { photoData } = req.body;

    if (!photoData) {
      return res.status(400).json({ error: 'Photo data is required' });
    }

    if (!veniceClient) {
      return res.status(500).json({ error: 'Venice API key not configured' });
    }

    const prompt = `Analyze this person's appearance for fashion styling purposes. Describe:
1. Body type and proportions (height estimate, build, body shape)
2. Skin tone and undertones
3. Hair color and style
4. Current outfit style and colors
5. Notable features that would affect clothing recommendations

Provide a detailed but concise description suitable for AI fashion styling.`;

    const response = await veniceClient.chat.completions.create({
      model: 'qwen3-vl-235b-a22b',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: photoData,
              },
            },
          ],
        },
      ],
    });

    const description = response.choices[0]?.message?.content ?? '';

    return res.json({
      description,
      type: 'analyze-person',
    });
  } catch (error) {
    console.error('Person analysis error:', error);
    return res.status(error.status || 500).json({
      error: error.message || 'Failed to analyze person from photo',
      details: error.stack && process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

module.exports = router;
