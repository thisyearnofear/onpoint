/**
 * POST /api/agent/studio-ai — metered chat-completions proxy for the AG
 * Studio agent on /agent/studio. The browser adapter sends an OpenAI-shaped
 * body; we forward it to the configured Otari workspace and return the
 * completion verbatim. Keys stay server-side; every turn is the same
 * metered AI the rest of the stack uses.
 *
 * Read-only by design: this route never sees PayPal or payment state —
 * it only answers questions over the public commerce data the page loads.
 */

const logger = require('../lib/logger');

const OTARI_BASE = () => process.env.OTARI_BASE_URL || 'https://api.otari.ai/api/v1';
const OTARI_MODEL = () => process.env.OTARI_CHAT_MODEL || process.env.OTARI_MODEL || '';

const express = require('express');
const router = express.Router();

const MAX_MESSAGES = 60;
const MAX_BODY_CHARS = 60_000;

router.post('/', async (req, res) => {
  const apiKey = process.env.OTARI_API_KEY;
  const model = OTARI_MODEL();
  if (!apiKey || !model) {
    return res.status(503).json({ error: 'studio_ai_unconfigured', hint: 'OTARI_API_KEY/OTARI_CHAT_MODEL not set' });
  }

  const { messages, tools, tool_choice, response_format } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    return res.status(400).json({ error: 'bad_request', hint: 'messages must be an array of 1..60 items' });
  }
  if (JSON.stringify(req.body).length > MAX_BODY_CHARS) {
    return res.status(413).json({ error: 'payload_too_large' });
  }
  for (const m of messages) {
    if (!m || typeof m.role !== 'string' || (typeof m.content !== 'string' && !Array.isArray(m.content) && m.content != null)) {
      return res.status(400).json({ error: 'bad_request', hint: 'each message needs role + content' });
    }
  }

  try {
    const upstream = await fetch(`${OTARI_BASE()}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        ...(Array.isArray(tools) && tools.length ? { tools } : {}),
        ...(tool_choice != null ? { tool_choice } : {}),
        ...(response_format != null ? { response_format } : {}),
      }),
      signal: AbortSignal.timeout(60_000),
    });

    const text = await upstream.text();
    if (!upstream.ok) {
      logger.warn('studio-ai upstream error', { component: 'studio-ai', status: upstream.status, body: text.slice(0, 300) });
      return res.status(502).json({ error: 'upstream_error', status: upstream.status, body: text.slice(0, 1000) });
    }
    res.type('application/json').send(text);
  } catch (err) {
    logger.warn('studio-ai fetch failed', { component: 'studio-ai', error: String(err?.message || err) });
    res.status(502).json({ error: 'upstream_unreachable' });
  }
});

module.exports = router;
