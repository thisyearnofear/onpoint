/**
 * Azure Computer Vision Analysis Route
 *
 * Server-side proxy that calls Azure Computer Vision 4.0 for fashion analysis.
 * Keeps AZURE_CV_API_KEY and AZURE_CV_ENDPOINT secure (never reaches the browser).
 *
 * Architecture:
 *   Browser → Hetzner Express → Azure CV API (Image Analysis 4.0) → Response
 */

const express = require('express');
const router = express.Router();
const logger = require('../lib/logger');

/**
 * Parse Azure Computer Vision 4.0 response into a formatted fashion analysis.
 */
function formatAzureAnalysis(result) {
  const parts = [];

  // Extract caption
  const captionResult = result.captionResult;
  if (captionResult?.text) {
    parts.push(`📝 ${captionResult.text}`);
  }

  // Extract dense captions for detailed descriptions
  const denseCaptions = result.denseCaptionsResult;
  if (denseCaptions?.values?.length) {
    const top = denseCaptions.values
      .filter((v) => (v.confidence ?? 0) > 0.5)
      .slice(0, 3)
      .map((v) => v.text)
      .filter(Boolean);
    if (top.length) {
      parts.push(`🔍 Details: ${top.join(' | ')}`);
    }
  }

  // Extract tags with high confidence
  const tagsResult = result.tagsResult;
  if (tagsResult?.tags?.length) {
    const nonFashion = new Set(['indoor', 'outdoor', 'text', 'person', 'portrait']);
    const clothingTags = tagsResult.tags
      .filter(
        (t) =>
          (t.confidence ?? 0) > 0.7 &&
          t.name &&
          !nonFashion.has(t.name.toLowerCase()),
      )
      .map((t) => t.name)
      .filter(Boolean);
    if (clothingTags.length) {
      parts.push(`👕 Detected: ${clothingTags.join(', ')}`);
    }
  }

  // Extract objects (garment-level detection)
  const objectsResult = result.objectsResult;
  if (objectsResult?.objects?.length) {
    const garments = objectsResult.objects
      .filter((o) => (o.confidence ?? 0) > 0.5 && o.name)
      .map((o) => o.name)
      .filter(Boolean);
    if (garments.length) {
      parts.push(`🎯 Items: ${garments.join(', ')}`);
    }
  }

  return parts.length > 0
    ? parts.join('\n\n')
    : 'Analysis completed. No specific fashion attributes detected in this frame.';
}

router.post('/', async (req, res) => {
  try {
    const { image, goal } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'Image is required' });
    }

    const endpoint = process.env.AZURE_CV_ENDPOINT;
    const apiKey = process.env.AZURE_CV_API_KEY;

    if (!endpoint || !apiKey) {
      return res.status(503).json({
        error: 'Azure Computer Vision not configured. Set AZURE_CV_ENDPOINT and AZURE_CV_API_KEY.',
      });
    }

    // Decode base64 image to binary for Azure CV API
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    const normalizedEndpoint = endpoint.replace(/\/$/, '');
    const azureUrl = `${normalizedEndpoint}/computervision/imageanalysis:analyze?api-version=2024-02-01&features=caption,denseCaptions,tags,objects`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const azureResponse = await fetch(azureUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(imageBuffer.length),
      },
      body: imageBuffer,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!azureResponse.ok) {
      const errorText = await azureResponse.text().catch(() => '');
      logger.error('Azure CV analysis failed', {
        component: 'azure-analyze',
        status: azureResponse.status,
      }, new Error(errorText || azureResponse.statusText));

      if (azureResponse.status === 429) {
        return res.status(429).json({
          error: 'Azure rate limit exceeded. Please wait and try again.',
        });
      }

      return res.status(azureResponse.status).json({
        error: `Azure analysis failed: ${errorText || azureResponse.statusText}`,
      });
    }

    const result = await azureResponse.json();
    const analysis = formatAzureAnalysis(result);

    if (!analysis) {
      return res.status(502).json({ error: 'Empty response from Azure Computer Vision' });
    }

    res.json({ analysis, model: 'azure-cv-4.0' });
  } catch (error) {
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Azure CV request timed out' });
    }
    logger.error('Azure CV request error', {
      component: 'azure-analyze',
    }, error);
    res.status(502).json({
      error: `Azure request failed: ${error.message || 'Unknown error'}`,
    });
  }
});

module.exports = router;
