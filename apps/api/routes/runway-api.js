/**
 * Runway Web API — /api/runway (ADR 0022, Phase A web surface).
 *
 * Public, rate-limited consumer endpoints so the web app can play the same
 * game the iMessage line hosts. Web players are tracked as `web:{uuid}`.
 *
 *   GET  /today                  — today's theme + judge samples + line number
 *   POST /rounds                 — { playerId, judge?, themeId? } → new round
 *   POST /rounds/:roundId/photo  — { playerId, photoData } → judge a photo
 *   GET  /results/:roundId       — public stored result (no chat ids)
 */

const express = require('express');
const logger = require('../lib/logger');
const { PERSONAS, getPersona } = require('../lib/runway/prompts');
const { themeOfDay } = require('../lib/runway/themes');
const engine = require('../lib/runway/engine');
const runwayState = require('../lib/runway/state');

const router = express.Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROUND_ID_RE = /^[a-f0-9]{12}$/;
const webChatId = (playerId) => `web:${playerId}`;

router.get('/today', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  const theme = themeOfDay();
  res.json({
    theme: { id: theme.id, name: theme.name, brief: theme.brief },
    judges: Object.values(PERSONAS).map((p) => ({ key: p.key, name: p.name, sample: p.intro[0] })),
    phoneNumber: process.env.RUNWAY_LINE_NUMBER || '+16282646604',
  });
});

router.post('/rounds', async (req, res) => {
  try {
    const { playerId, judge: judgeKey, themeId } = req.body || {};
    if (typeof playerId !== 'string' || !UUID_RE.test(playerId)) {
      return res.status(400).json({ error: 'playerId must be a UUID v4' });
    }
    const out = await engine.startRound(webChatId(playerId), {
      personaKey: judgeKey,
      themeId,
      surface: 'web',
    });
    if (out.status === 'capped') {
      return res.status(429).json({ status: 'capped', persona: out.persona, messages: out.messages });
    }
    return res.status(201).json({
      status: 'started',
      roundId: out.round.roundId,
      theme: { id: out.theme.id, name: out.theme.name, brief: out.theme.brief },
      persona: out.persona,
      messages: out.messages,
      deadline: out.round.deadline,
    });
  } catch (err) {
    logger.error('runway round start failed', { component: 'runway-api', error: err.message });
    return res.status(500).json({ error: 'Could not start a round' });
  }
});

router.post('/rounds/:roundId/photo', async (req, res) => {
  try {
    const { playerId, photoData } = req.body || {};
    if (typeof playerId !== 'string' || !UUID_RE.test(playerId)) {
      return res.status(400).json({ error: 'playerId must be a UUID v4' });
    }
    if (!ROUND_ID_RE.test(req.params.roundId)) {
      return res.status(400).json({ error: 'invalid round id' });
    }
    const round = await runwayState.getRound(webChatId(playerId));
    if (!round || round.roundId !== req.params.roundId || round.status !== 'awaiting_photo') {
      return res.status(409).json({ error: 'No awaiting round matches that roundId' });
    }
    const out = await engine.submitPhoto(webChatId(playerId), {
      imageDataUrl: photoData,
      surface: 'web',
    });
    const body = {
      status: out.status,
      persona: { key: out.persona.key, name: out.persona.name },
      messages: out.messages,
    };
    if (out.status === 'ok') {
      body.result = {
        scores: out.result.scores,
        total: out.result.total,
        verdict: out.result.verdict,
        fixHint: out.result.fixHint,
        late: out.result.late,
      };
      if (out.fix) {
        body.fix = { kind: out.fix.kind, title: out.fix.title, imageUrl: out.fix.imageUrl, url: out.fix.url };
      }
    }
    return res.json(body);
  } catch (err) {
    logger.error('runway photo submit failed', { component: 'runway-api', error: err.message });
    return res.status(500).json({ error: 'Could not judge the photo' });
  }
});

router.get('/results/:roundId', async (req, res) => {
  try {
    if (!ROUND_ID_RE.test(req.params.roundId)) {
      return res.status(404).json({ error: 'Result not found' });
    }
    const result = await runwayState.getResult(req.params.roundId);
    if (!result) return res.status(404).json({ error: 'Result not found' });
    res.set('Cache-Control', 'public, max-age=3600');
    return res.json({
      roundId: result.roundId,
      themeId: result.themeId,
      themeName: result.themeName,
      persona: result.persona,
      scores: result.scores,
      total: result.total,
      verdict: result.verdict,
      fixHint: result.fixHint,
      fix: result.fix || null,
      late: result.late,
      createdAt: result.createdAt,
    });
  } catch (err) {
    logger.error('runway result fetch failed', { component: 'runway-api', error: err.message });
    return res.status(500).json({ error: 'Could not load the result' });
  }
});

module.exports = router;
