/**
 * Runway game engine (ADR 0022 §4). Channel-agnostic orchestrator:
 * startRound / submitPhoto are the structured core; handleInbound composes
 * them into outbound intents for the chat adapter (iMessage today).
 *
 * Intent shapes:
 *   { type: 'text', text }
 *   { type: 'link', url }
 *   { type: 'card', cardUrl, cardImageUrl, caption, subcaption }
 */

const { getPersona, DEFAULT_PERSONA } = require('./prompts');
const { THEMES, getTheme, pickTheme, FREESTYLE_ID } = require('./themes');
const state = require('./state');
const judge = require('./judge');
const photo = require('./photo');
const fix = require('./fix');
const { logFunnelEvent } = require('../funnel');
const { webBaseUrl } = require('../agent-commerce');
const logger = require('../logger');

const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL || 'https://api.onpoint.famile.xyz').replace(/\/$/, '');
const THEME_IDS = new Set(THEMES.map((t) => t.id));
const HELP_TEXT =
  "Runway — a closet challenge. Text 'play' for a theme, then send one full-length photo within 3 minutes and I'll score it. Commands: play · again · judge miranda|edina|shaft · help";

const CAP_LINES = {
  miranda: "That's enough for today. Come back tomorrow.",
  edina: "Darling, even I need a break — that's enough for today. Tomorrow!",
  shaft: "That's a wrap for today. Back tomorrow.",
};

const funnel = (eventType, metadata, surface = 'imessage') => {
  try {
    logFunnelEvent(null, { eventType, source: 'runway', metadata: { ...metadata, surface } });
  } catch {
    // best-effort
  }
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const fmtTotal = (n) => Number(n).toFixed(1);

/**
 * Deal a new round. Returns status 'started' or 'capped' (daily round cap —
 * round/theme/messages are null in that case except the persona cap line).
 */
async function startRound(chatId, { personaKey, themeId, now = Date.now(), surface = 'imessage' } = {}) {
  const persona = getPersona(personaKey);
  if ((await state.incrChatRounds(chatId, now)) > state.ROUNDS_PER_CHAT_DAY) {
    return {
      status: 'capped',
      round: null,
      theme: null,
      persona: { key: persona.key, name: persona.name },
      messages: [CAP_LINES[persona.key] || CAP_LINES.miranda],
    };
  }
  const prev = await state.getRound(chatId);
  const theme = THEME_IDS.has(themeId) ? getTheme(themeId) : pickTheme(prev?.recentThemes || []);
  const recentThemes = [theme.id, ...(prev?.recentThemes || [])].slice(0, 5);
  const round = await state.saveRound(chatId, state.newRound({
    themeId: theme.id,
    persona: persona.key,
    now,
    recentThemes,
  }));
  funnel('runway_start', { themeId: theme.id, persona: persona.key, roundId: round.roundId }, surface);
  return {
    status: 'started',
    round,
    theme,
    persona: { key: persona.key, name: persona.name },
    messages: [pick(persona.intro), persona.start(theme)],
  };
}

/**
 * Judge a photo for the chat's awaiting round (freestyle round is created on
 * the fly when none is awaiting).
 */
async function submitPhoto(chatId, { photoUrl, imageDataUrl, now = Date.now(), surface = 'imessage' }) {
  let round = await state.getRound(chatId);
  let theme;
  if (!round || round.status !== 'awaiting_photo') {
    theme = getTheme(FREESTYLE_ID);
    round = await state.saveRound(chatId, state.newRound({
      themeId: theme.id,
      persona: round?.persona || DEFAULT_PERSONA,
      now,
      recentThemes: round?.recentThemes || [],
    }));
  } else {
    theme = getTheme(round.themeId);
  }
  const persona = getPersona(round.persona);
  const late = now > round.deadline;
  funnel('runway_submit', { roundId: round.roundId, late }, surface);

  let dataUrl = imageDataUrl;
  try {
    if (!dataUrl) dataUrl = await photo.fetchAsDataUrl(photoUrl);
    else dataUrl = await photo.normaliseDataUrl(dataUrl);
  } catch (err) {
    logger.warn('runway photo load failed', { component: 'runway', error: err.message });
    funnel('runway_unavailable', { roundId: round.roundId }, surface);
    return { status: 'unavailable', round, theme, persona, result: null, fix: null, messages: [pick(persona.fallback)] };
  }

  let verdict;
  try {
    verdict = await judge.judgeOutfit({ imageDataUrl: dataUrl, theme, persona, late });
  } catch (err) {
    logger.warn('runway judge failed', { component: 'runway', error: err.message });
    funnel('runway_unavailable', { roundId: round.roundId }, surface);
    return { status: 'unavailable', round, theme, persona, result: null, fix: null, messages: [pick(persona.fallback)] };
  }

  if (verdict.reason === 'refused') {
    funnel('runway_refused', { roundId: round.roundId }, surface);
    return { status: 'refused', round, theme, persona, result: null, fix: null, messages: [persona.refusal] };
  }
  if (!verdict.ok) {
    funnel('runway_unavailable', { roundId: round.roundId }, surface);
    return { status: 'unavailable', round, theme, persona, result: null, fix: null, messages: [pick(persona.fallback)] };
  }

  const channel = surface === 'imessage' ? 'imessage' : 'direct';
  const foundFix = await fix.findFix({ theme, fixTags: verdict.fixTags, channel, personaKey: persona.key });
  if (foundFix) funnel('runway_fix', { roundId: round.roundId, shareId: foundFix.shareId, kind: foundFix.kind }, surface);

  const result = await state.saveResult(round.roundId, {
    roundId: round.roundId,
    themeId: theme.id,
    themeName: theme.name,
    persona: persona.key,
    scores: verdict.scores,
    total: verdict.total,
    verdict: verdict.verdict,
    fixHint: verdict.fixHint,
    fix: foundFix ? { title: foundFix.title, url: foundFix.url, kind: foundFix.kind, imageUrl: foundFix.imageUrl } : null,
    late,
    provider: verdict.provider,
    createdAt: now,
  });
  await state.saveRound(chatId, { ...round, status: 'judged' });
  funnel('runway_verdict', {
    roundId: round.roundId,
    themeId: theme.id,
    persona: persona.key,
    provider: verdict.provider,
    total: verdict.total,
    late,
  }, surface);

  return {
    status: 'ok',
    round,
    theme,
    persona,
    result,
    fix: foundFix,
    messages: [
      `${verdict.verdict}\n\n${persona.name}'s score: ${fmtTotal(verdict.total)}/10`,
      ...(foundFix ? [`The fix: ${verdict.fixHint}. Closest piece I have: ${foundFix.title}`] : []),
      "Reply 'again' for a new theme.",
    ],
  };
}

/**
 * Chat entrypoint — returns outbound intents.
 * @returns {Promise<Array<intent>>}
 */
async function handleInbound({ chatId, text, photoUrl, now = Date.now() }) {
  if (photoUrl) {
    const out = await submitPhoto(chatId, { photoUrl, now, surface: 'imessage' });
    if (out.status !== 'ok') return out.messages.map((m) => ({ type: 'text', text: m }));

    const intents = [{ type: 'text', text: out.messages[0] }];
    const web = webBaseUrl();
    intents.push({
      type: 'card',
      cardUrl: `${web}/runway/r/${out.round.roundId}`,
      cardImageUrl: `${PUBLIC_BASE}/runway/card/${out.round.roundId}.png`,
      caption: `Runway · ${out.theme.name}`,
      subcaption: `${fmtTotal(out.result.total)}/10 — judged by ${out.persona.name}`,
    });
    if (out.fix) {
      intents.push({ type: 'text', text: out.messages[1] });
      intents.push({ type: 'link', url: out.fix.url });
      intents.push({ type: 'text', text: out.messages[2] });
    } else {
      intents.push({ type: 'text', text: out.messages[1] });
    }
    return intents;
  }

  const raw = String(text || '').trim();
  const lower = raw.toLowerCase();
  const round = await state.getRound(chatId);
  const awaiting = round && round.status === 'awaiting_photo';

  const texts = async (started) =>
    started.messages.map((m) => ({ type: 'text', text: m }));

  if (lower === 'help') return [{ type: 'text', text: HELP_TEXT }];

  const judgeMatch = /^judge\s+(\w+)$/.exec(lower);
  if (judgeMatch) return texts(await startRound(chatId, { personaKey: judgeMatch[1], now }));

  if (lower === 'again' || lower === 'next' || lower === 'new') {
    return texts(await startRound(chatId, { personaKey: round?.persona || DEFAULT_PERSONA, now }));
  }

  const playMatch = /^play\s+([a-z0-9-]+)$/.exec(lower);
  if (playMatch) {
    return texts(await startRound(chatId, {
      personaKey: round?.persona || DEFAULT_PERSONA,
      themeId: playMatch[1],
      now,
    }));
  }

  if (lower === 'play' || lower === 'runway' || lower === 'start' || !awaiting) {
    return texts(await startRound(chatId, { personaKey: round?.persona || DEFAULT_PERSONA, now }));
  }

  // Text while a round awaits a photo — nudge, never a new round.
  const persona = getPersona(round.persona);
  return [{ type: 'text', text: persona.nudge(Math.max(0, Math.round((round.deadline - now) / 1000))) }];
}

module.exports = { handleInbound, startRound, submitPhoto };
