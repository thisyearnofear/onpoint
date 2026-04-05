/**
 * AI Virtual Try-On Route
 *
 * Express port of apps/web/app/api/ai/virtual-tryon/route.ts
 * Supports body-analysis, outfit-fit, enhancement, generate-outfit-image
 */

const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');

// ---------------------------------------------------------------------------
// Provider setup (inline, mirrors _utils/providers.ts)
// ---------------------------------------------------------------------------

const VENICE_BASE_URL = 'https://api.venice.ai/api/v1';

const geminiKey =
  process.env.GEMINI_API_KEY &&
  process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here'
    ? process.env.GEMINI_API_KEY
    : null;
const openaiKey =
  process.env.OPENAI_API_KEY &&
  process.env.OPENAI_API_KEY !== 'your_openai_api_key_here'
    ? process.env.OPENAI_API_KEY
    : null;
const veniceKey = process.env.VENICE_API_KEY || null;

const geminiClient = geminiKey ? new GoogleGenerativeAI(geminiKey) : null;
const openaiClient = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null;
const veniceClient = veniceKey
  ? new OpenAI({ apiKey: veniceKey, baseURL: VENICE_BASE_URL })
  : null;

// ---------------------------------------------------------------------------
// generateVisionAnalysis – uses Venice vision model for image analysis
// ---------------------------------------------------------------------------

async function generateVisionAnalysis({
  prompt,
  imageBase64,
  veniceModel = 'qwen3-vl-235b-a22b',
}) {
  if (!veniceClient) {
    throw new Error('Venice API key required for vision analysis');
  }

  try {
    const response = await veniceClient.chat.completions.create({
      model: veniceModel,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: imageBase64, // Venice accepts base64 data URIs
              },
            },
          ],
        },
      ],
    });
    return { text: response.choices[0]?.message?.content ?? '', usedProvider: 'venice-vision' };
  } catch (err) {
    console.error('[generateVisionAnalysis] venice vision failed:', err.message || err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// generateText – tries Venice → Gemini → OpenAI based on availability
// ---------------------------------------------------------------------------

async function generateText({
  prompt,
  provider = 'auto',
  veniceModel = 'llama-3.3-70b',
  geminiModel = 'gemini-3.1-flash-lite-preview',
  openaiModel = 'gpt-4o',
  openaiOptions = {},
}) {
  const hasVenice = !!veniceClient;
  const hasGemini = !!geminiClient;
  const hasOpenAI = !!openaiClient;

  let selected = null;
  if (provider === 'venice') {
    selected = hasVenice ? 'venice' : null;
  } else if (provider === 'gemini') {
    selected = hasGemini ? 'gemini' : null;
  } else if (provider === 'openai') {
    selected = hasOpenAI ? 'openai' : null;
  } else {
    // auto: Venice → Gemini → OpenAI
    if (hasVenice) selected = 'venice';
    else if (hasGemini) selected = 'gemini';
    else if (hasOpenAI) selected = 'openai';
  }

  if (!selected) {
    throw new Error(
      'No AI provider available. Configure VENICE_API_KEY, GEMINI_API_KEY or OPENAI_API_KEY.',
    );
  }

  // Build ordered list of providers to try (selected first, then fallbacks)
  const all = ['venice', 'gemini', 'openai'];
  const available = { venice: hasVenice, gemini: hasGemini, openai: hasOpenAI };
  const order = [selected, ...all.filter((p) => p !== selected && available[p])];

  for (const prov of order) {
    try {
      if (prov === 'venice') {
        const response = await veniceClient.chat.completions.create({
          model: veniceModel,
          messages: [{ role: 'user', content: prompt }],
          ...openaiOptions,
        });
        return { text: response.choices[0]?.message?.content ?? '', usedProvider: 'venice' };
      }
      if (prov === 'gemini') {
        const model = geminiClient.getGenerativeModel({ model: geminiModel });
        const response = await model.generateContent(prompt);
        return { text: response.response.text() ?? '', usedProvider: 'gemini' };
      }
      if (prov === 'openai') {
        const response = await openaiClient.chat.completions.create({
          model: openaiModel,
          messages: [{ role: 'user', content: prompt }],
          ...openaiOptions,
        });
        return { text: response.choices[0]?.message?.content ?? '', usedProvider: 'openai' };
      }
    } catch (err) {
      console.error(`[generateText] ${prov} failed:`, err.message || err);
      // continue to next provider
    }
  }

  throw new Error('All AI providers failed.');
}

// ---------------------------------------------------------------------------
// Text-parsing helpers (ported as-is from the Next.js route)
// ---------------------------------------------------------------------------

function extractMeasurement(text, bodyPart) {
  const sizeWords = ['small', 'medium', 'large', 'extra small', 'extra large'];
  const regex = new RegExp(`${bodyPart}[:\\s]*([^\\n]*?)(?=\\n|$)`, 'i');
  const match = text.match(regex);

  if (match && match[1]) {
    const measurementValue = match[1];
    const found = sizeWords.find((size) =>
      measurementValue.toLowerCase().includes(size),
    );
    return found || 'medium';
  }
  return null;
}

function extractRecommendations(text) {
  const recommendations = [];
  const lines = text.split('\n');

  for (const line of lines) {
    if (
      line.includes('recommend') ||
      line.includes('suggest') ||
      line.includes('try') ||
      line.includes('consider')
    ) {
      const cleaned = line.replace(/^\d+\.?\s*/, '').trim();
      if (cleaned.length > 10) {
        recommendations.push(cleaned);
      }
    }
  }

  return recommendations.length > 0 ? recommendations.slice(0, 4) : [];
}

function extractStyleAdjustments(text) {
  const adjustments = [];
  const lines = text.split('\n');

  for (const line of lines) {
    if (
      line.includes('adjust') ||
      line.includes('balance') ||
      line.includes('enhance') ||
      line.includes('flatter')
    ) {
      const cleaned = line.replace(/^\d+\.?\s*/, '').trim();
      if (cleaned.length > 10) {
        adjustments.push(cleaned);
      }
    }
  }

  return adjustments.length > 0 ? adjustments.slice(0, 3) : [];
}

function extractStructuredStylingTips(text) {
  try {
    const cleaned = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.text) {
      const valid = parsed
        .slice(0, 4)
        .filter((item) => typeof item.text === 'string');
      return {
        textTips: valid.map((item) => item.text),
        structuredTips: valid.map((item) => ({
          text: item.text,
          action:
            item.action &&
            item.action.type &&
            item.action.label &&
            item.action.payload
              ? item.action
              : undefined,
        })),
      };
    }
  } catch {
    // Fall back
  }

  const tips = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const isTipLine =
      /^\d+\./.test(line) ||
      /^[-•*]/.test(line) ||
      /\b(tip|style|wear|pair|color|accessory|fit|flatter|enhance|complement)\b/i.test(
        line,
      );
    if (isTipLine) {
      const cleaned = line
        .replace(/^\d+\.?\s*/, '')
        .replace(/^[-•*]\s*/, '')
        .trim();
      if (cleaned.length > 10 && cleaned.length < 200) {
        tips.push(cleaned);
      }
    }
  }
  if (tips.length === 0) {
    const sentences = text
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 20 && s.trim().length < 150);
    tips.push(...sentences.slice(0, 4));
  }
  const textTips =
    tips.length > 0
      ? tips.slice(0, 4)
      : [
          'Layer pieces to add depth and dimension to your outfit',
          'Choose accessories that complement your personal style',
          'Ensure proper fit for comfort and confidence',
          'Consider the color harmony of your complete look',
        ];
  return { textTips, structuredTips: textTips.map((text) => ({ text })) };
}

function extractStylingTips(text) {
  return extractStructuredStylingTips(text).textTips;
}

function extractOutfitRecommendations(text) {
  const recommendations = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length && recommendations.length < 5; i++) {
    const line = lines[i];
    if (
      line &&
      (line.includes('recommend') ||
        line.includes('suggest') ||
        line.includes('add') ||
        line.includes('try'))
    ) {
      const cleaned = line.replace(/^\d+\.?\s*/, '').trim();
      if (cleaned.length > 10) {
        recommendations.push({
          item: cleaned,
          reason: 'Based on style analysis',
          priority: recommendations.length + 1,
        });
      }
    }
  }
  return recommendations.length > 0
    ? recommendations
    : [
        { item: 'Consider color coordination', reason: 'Enhances overall look', priority: 1 },
        { item: 'Add complementary accessories', reason: 'Completes the outfit', priority: 2 },
        { item: 'Pay attention to fit and proportions', reason: 'Ensures flattering silhouette', priority: 3 },
      ];
}

function parseVirtualTryOnResponse(aiResponse, type, originalData) {
  if (type === 'body-analysis') {
    const bodyTypeMatch = aiResponse.match(/body type[:\s]*(\w+)/i);
    const bodyType = bodyTypeMatch ? bodyTypeMatch[1] : 'average';
    const measurements = {
      shoulders: extractMeasurement(aiResponse, 'shoulders') || 'medium',
      chest: extractMeasurement(aiResponse, 'chest') || 'medium',
      waist: extractMeasurement(aiResponse, 'waist') || 'medium',
      hips: extractMeasurement(aiResponse, 'hips') || 'medium',
    };
    const fitRecommendations = extractRecommendations(aiResponse);
    const styleAdjustments = extractStyleAdjustments(aiResponse);
    return { bodyType, measurements, fitRecommendations, styleAdjustments, analysis: aiResponse };
  } else if (type === 'outfit-fit' || type === 'enhancement') {
    const stylingTips = extractStylingTips(aiResponse);
    const recommendations = extractOutfitRecommendations(aiResponse);
    return {
      stylingTips,
      recommendations,
      analysis: aiResponse,
      enhancedOutfit: (originalData && originalData.items) || [],
    };
  }
  return { analysis: aiResponse };
}

// ---------------------------------------------------------------------------
// POST /
// ---------------------------------------------------------------------------

router.post('/', async (req, res) => {
  try {
    const { type, data, provider = 'auto', model } = req.body;

    if (!type) {
      return res.status(400).json({ error: 'Analysis type is required' });
    }

    // -- analyze-person (Venice vision API for photo analysis) --
    if (type === 'analyze-person' && data && data.photoData) {
      if (!veniceClient) {
        return res.status(500).json({ error: 'Venice API key required for vision analysis' });
      }

      const prompt = `Analyze this person's appearance for fashion styling purposes. Describe:
1. Body type and proportions (height estimate, build, body shape)
2. Skin tone and undertones
3. Hair color and style
4. Current outfit style and colors
5. Notable features that would affect clothing recommendations

Provide a detailed but concise description suitable for AI fashion styling.`;

      try {
        const { text } = await generateVisionAnalysis({
          prompt,
          imageBase64: data.photoData,
        });
        return res.json({ description: text, type: 'analyze-person' });
      } catch (error) {
        console.error('Vision analysis error:', error);
        return res.status(500).json({ error: 'Failed to analyze person from photo' });
      }
    }

    // -- body-analysis with photo (Venice vision API) --
    if (type === 'body-analysis' && data && data.photoData) {
      if (!veniceClient) {
        return res.status(500).json({ error: 'Venice API key required for vision analysis' });
      }

      const prompt = `As a professional fashion fit specialist, analyze this person's body measurements and proportions from the photo. Provide:

1. Body Type: (e.g., athletic, average, slim, curvy, plus-size)
2. Measurements (estimate relative sizes):
   - Shoulders: (small/medium/large/extra large)
   - Chest: (small/medium/large/extra large)
   - Waist: (small/medium/large/extra large)
   - Hips: (small/medium/large/extra large)
3. Fit Recommendations: Specific advice for clothing fit based on body proportions
4. Style Adjustments: How to balance proportions and flatter the figure

Be specific and practical. Focus on actionable fashion advice.`;

      try {
        const { text } = await generateVisionAnalysis({
          prompt,
          imageBase64: data.photoData,
        });
        const analysisData = parseVirtualTryOnResponse(text, 'body-analysis', data);
        return res.json({ ...analysisData, provider: 'venice-vision', type });
      } catch (error) {
        console.error('Vision body analysis error:', error);
        return res.status(500).json({ error: 'Failed to analyze body from photo' });
      }
    }

    // -- outfit-fit with photo (Venice vision API) --
    if (type === 'outfit-fit' && data && data.photoData) {
      if (!veniceClient) {
        return res.status(500).json({ error: 'Venice API key required for vision analysis' });
      }

      const outfitDescription = data.items
        ? data.items.map((item) => `${item.name}: ${item.description || item.type || ''}`).join(', ')
        : '';

      const prompt = `As a fashion stylist, analyze how these outfit items would look on this person: ${outfitDescription}

Based on the person's body type, coloring, and current style visible in the photo, provide:
1. How well each piece would fit
2. Color compatibility with their skin tone and features
3. Style cohesion and overall look
4. Specific styling tips to make the outfit work better
5. Accessories or adjustments to enhance the look

Be specific and actionable.`;

      try {
        const { text } = await generateVisionAnalysis({
          prompt,
          imageBase64: data.photoData,
        });
        const analysisData = parseVirtualTryOnResponse(text, 'outfit-fit', data);
        return res.json({ ...analysisData, provider: 'venice-vision', type });
      } catch (error) {
        console.error('Vision outfit analysis error:', error);
        return res.status(500).json({ error: 'Failed to analyze outfit fit from photo' });
      }
    }

    // -- generate-outfit-image (Venice image API) --
    if (type === 'generate-outfit-image') {
      const veniceApiKey = process.env.VENICE_API_KEY;
      if (!veniceApiKey) {
        return res.status(500).json({ error: 'Venice API key not configured' });
      }

      const personDescription = (data && data.personDescription) || '';
      const outfitDescription = data && data.items
        ? data.items.map((item) => `${item.name}: ${item.description || ''}`).join(', ')
        : '';

      const veniceResponse = await fetch('https://api.venice.ai/api/v1/image/generate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${veniceApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'venice-sd35',
          prompt: `Create a high-quality fashion photograph. ${personDescription ? `Person: ${personDescription}. ` : ''}Wearing: ${outfitDescription}. Full-body portrait, professional photography.`,
          width: 512,
          height: 768,
          format: 'webp',
        }),
      });

      if (!veniceResponse.ok) {
        throw new Error(`Venice API error: ${veniceResponse.status}`);
      }
      const veniceData = await veniceResponse.json();

      let personalizedTips = [];
      let structuredTips = [];
      if (personDescription) {
        const tipsResponse = await generateText({
          prompt: `Styling tips for: ${personDescription} wearing ${outfitDescription}. Return JSON: [{"text": "...", "action": {...}}]`,
          provider,
          geminiModel: 'gemini-3.1-flash-lite-preview',
          openaiModel: 'gpt-4o',
        });
        const parsed = extractStructuredStylingTips(tipsResponse.text || '');
        personalizedTips = parsed.textTips;
        structuredTips = parsed.structuredTips;
      }

      return res.json({
        generatedImage: veniceData.images[0],
        enhancedOutfit: (data && data.items) || [],
        stylingTips: personalizedTips.length
          ? personalizedTips
          : ['Layer up', 'Accessorize', 'Check fit', 'Color harmony'],
        structuredTips,
        type,
      });
    }

    // -- text-based analysis types --
    let enhancedPrompt = '';
    if (type === 'body-analysis') {
      enhancedPrompt = `As a fashion fit specialist, analyze this body profile: "${(data && data.description) || 'Standard body measurements'}". Keep it practical and focused on measurements and fit.`;
    } else if (type === 'outfit-fit') {
      enhancedPrompt = `As a fashion stylist, analyze how these outfit items would work together: "${data && data.items ? data.items.map((item) => `${item.name}: ${item.description || item.type || ''}`).join(', ') : ''}". Provide actionable styling advice.`;
    } else if (type === 'enhancement') {
      enhancedPrompt = `As a virtual styling consultant, enhance this outfit combination: "${data && data.items ? data.items.map((item) => `${item.name}: ${item.description || ''}`).join(', ') : ''}".`;
    } else {
      enhancedPrompt = `As a fashion consultant, provide analysis for: ${type}`;
    }

    const modelChoice = model;
    const { text, usedProvider } = await generateText({
      prompt: enhancedPrompt,
      provider,
      geminiModel: modelChoice === 'pro' ? 'gemini-3.1-pro' : 'gemini-3.1-flash-lite-preview',
      openaiModel: modelChoice === 'pro' ? 'gpt-4o' : 'gpt-4o-mini',
    });

    const analysisData = parseVirtualTryOnResponse(text || '', type, data);
    return res.json({ ...analysisData, provider: usedProvider, type });
  } catch (error) {
    console.error('AI virtual try-on error:', error);
    return res.status(error.status || 500).json({
      error: error.message || 'Failed to process virtual try-on',
      details: error.stack && process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

module.exports = router;
