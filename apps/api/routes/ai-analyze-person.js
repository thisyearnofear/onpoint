/**
 * AI Analyze Person Route
 *
 * Uses Gemini vision to analyze a person from a base64 photo.
 * Returns a text description of the person.
 */

const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const geminiKey =
  process.env.GEMINI_API_KEY &&
  process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here'
    ? process.env.GEMINI_API_KEY
    : null;

const geminiClient = geminiKey ? new GoogleGenerativeAI(geminiKey) : null;

router.post('/', async (req, res) => {
  try {
    const { photoData } = req.body;

    if (!photoData) {
      return res.status(400).json({ error: 'photoData is required' });
    }

    if (!geminiClient) {
      return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
    }

    // Strip data URL prefix (e.g. "data:image/jpeg;base64,") if present
    let base64Data = photoData;
    let mimeType = 'image/jpeg';
    const dataUrlMatch = photoData.match(/^data:(image\/\w+);base64,/);
    if (dataUrlMatch) {
      mimeType = dataUrlMatch[1];
      base64Data = photoData.replace(/^data:image\/\w+;base64,/, '');
    }

    const model = geminiClient.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });
    const response = await model.generateContent([
      {
        text: 'Describe this person in detail for fashion styling purposes. Include their apparent body type, build, skin tone, hair color/style, and any visible features relevant to clothing recommendations. Be respectful and objective.',
      },
      {
        inlineData: {
          data: base64Data,
          mimeType,
        },
      },
    ]);

    const description = response.response.text() ?? '';
    return res.json({ description });
  } catch (error) {
    console.error('AI analyze person error:', error);
    return res.status(error.status || 500).json({
      error: error.message || 'Failed to analyze person',
      details: error.stack && process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

module.exports = router;
