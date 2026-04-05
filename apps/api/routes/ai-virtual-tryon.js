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
// Text-parsing helpers for structured vision responses
// ---------------------------------------------------------------------------

function extractSection(text, startMarker, endMarker) {
  const startIdx = text.indexOf(startMarker);
  if (startIdx === -1) return [];
  
  const contentStart = startIdx + startMarker.length;
  const endIdx = endMarker ? text.indexOf(endMarker, contentStart) : text.length;
  const section = text.substring(contentStart, endIdx === -1 ? text.length : endIdx).trim();
  
  // Split into bullet points or lines
  const lines = section.split('\n')
    .map(line => line.replace(/^[-•*]\s*/, '').trim())
    .filter(line => line.length > 15 && !line.match(/^(CURRENT|BODY|FIT|STYLE|PERSONALIZATION)/));
  
  return lines.length > 0 ? lines : [section];
}

function extractBodyType(text) {
  const match = text.match(/Body Type:\s*([^\n]+)/i);
  if (match) {
    const type = match[1].toLowerCase().trim();
    if (type.includes('athletic')) return 'athletic';
    if (type.includes('slim')) return 'slim';
    if (type.includes('curvy')) return 'curvy';
    if (type.includes('plus')) return 'plus-size';
    return 'average';
  }
  return 'average';
}

function extractMeasurementsStructured(text) {
  const measurements = {
    shoulders: 'medium',
    chest: 'medium',
    waist: 'medium',
    hips: 'medium'
  };
  
  const shouldersMatch = text.match(/Shoulders:\s*(small|medium|large)/i);
  const chestMatch = text.match(/Chest:\s*(small|medium|large)/i);
  const waistMatch = text.match(/Waist:\s*(small|medium|large)/i);
  const hipsMatch = text.match(/Hips:\s*(small|medium|large)/i);
  
  if (shouldersMatch) measurements.shoulders = shouldersMatch[1].toLowerCase();
  if (chestMatch) measurements.chest = chestMatch[1].toLowerCase();
  if (waistMatch) measurements.waist = waistMatch[1].toLowerCase();
  if (hipsMatch) measurements.hips = hipsMatch[1].toLowerCase();
  
  return measurements;
}

// ---------------------------------------------------------------------------
// Legacy parsing helpers (kept for backward compatibility)
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

      const prompt = `Analyze this person's appearance for fashion styling. Be SPECIFIC about what you see:

WHAT THEY'RE WEARING NOW:
- Describe each clothing item in detail (color, style, fit, condition)
- Note any accessories, shoes, or styling details

PHYSICAL FEATURES:
- Body type and build (be specific, not generic)
- Height estimate and proportions
- Skin tone (warm/cool/neutral undertones, specific shade)
- Hair (color, length, texture, style)
- Face shape and features that affect styling

STYLE ASSESSMENT:
- Current style category (e.g., casual, preppy, streetwear, minimalist)
- What's working in their current look
- What could be improved

PERSONALIZED STYLING NOTES:
- Best colors for their specific skin tone and hair
- Ideal silhouettes for their body type
- Style recommendations that match their vibe

Be detailed and specific. This will be used to generate highly personalized outfit recommendations.`;

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

      const prompt = `You are an expert fashion stylist analyzing this photo. Provide a structured analysis in the following format:

CURRENT LOOK:
[Describe what they're wearing now - specific items, colors, fit, style]

BODY ANALYSIS:
Body Type: [athletic/slim/average/curvy/plus-size - be specific]
Shoulders: [small/medium/large]
Chest: [small/medium/large]
Waist: [small/medium/large]
Hips: [small/medium/large]
Key Proportions: [What stands out about their build]

FIT RECOMMENDATIONS:
[3-4 specific recommendations about sizing, fit, and tailoring for their body type]
- Focus on: What sizes to look for, how clothes should fit their proportions, tailoring needs

STYLE RECOMMENDATIONS:
[3-4 specific style suggestions based on their coloring, current style, and body type]
- Focus on: Colors that suit them, style categories, specific pieces, what to avoid

PERSONALIZATION:
[2-3 highly specific tips based on what you see in THIS photo - reference their actual outfit, hair, coloring]

Be SPECIFIC and ACTIONABLE. Reference what you actually see.`;

      try {
        const { text } = await generateVisionAnalysis({
          prompt,
          imageBase64: data.photoData,
        });
        
        // Parse structured response
        const sections = {
          currentLook: extractSection(text, 'CURRENT LOOK:', 'BODY ANALYSIS:'),
          bodyType: extractBodyType(text),
          measurements: extractMeasurementsStructured(text),
          fitRecommendations: extractSection(text, 'FIT RECOMMENDATIONS:', 'STYLE RECOMMENDATIONS:'),
          styleRecommendations: extractSection(text, 'STYLE RECOMMENDATIONS:', 'PERSONALIZATION:'),
          personalization: extractSection(text, 'PERSONALIZATION:', null),
        };
        
        return res.json({ 
          ...sections,
          provider: 'venice-vision', 
          type,
          rawAnalysis: text 
        });
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

      const prompt = `You are a personal stylist. Look at this person in the photo and analyze how these outfit items would work for them: ${outfitDescription}

WHAT YOU SEE IN THE PHOTO:
- Describe their current outfit, body type, coloring, and style

OUTFIT ANALYSIS:
- How would each proposed item fit their specific body type?
- Which colors would complement their actual skin tone and hair color?
- Does the style match their vibe or would it be a departure?
- What specific adjustments would make these items work better for them?

PERSONALIZED STYLING:
- Specific tips for wearing these items based on their proportions
- Accessories that would complete the look for their style
- Colors from the outfit that work best with their coloring
- Any items that might not work and why

Be SPECIFIC. Reference what you see in the photo. Give actionable, personalized advice.`;

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
