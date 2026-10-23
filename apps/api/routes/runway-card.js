/**
 * Runway Card Route — /runway/card/:roundId[.png] (ADR 0022 §1.3).
 *
 * The spoiler-free result artifact shared after a judged round. The PNG is
 * the og:image / iMessage card image; the HTML route redirects to the web
 * share page at {web}/runway/r/:roundId.
 *
 *   GET /runway/card/:roundId.png — 1200x630 PNG (og:image / iMessage card)
 *   GET /runway/card/:roundId     — 302 → web share page
 *
 * Public — round ids are unguessable (12 hex). No user photo, ever.
 */

const express = require('express');
const sharp = require('sharp');
const logger = require('../lib/logger');
const runwayState = require('../lib/runway/state');
const { getPersona } = require('../lib/runway/prompts');
const { webBaseUrl } = require('../lib/agent-commerce');

const router = express.Router();

const ROUND_ID_RE = /^[a-f0-9]{12}$/;

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// naive word-wrap for SVG text (no DOM measurement — approximate widths)
function wrapText(text, maxChars = 64, maxLines = 3) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = w;
      if (lines.length >= maxLines - 1) break;
    } else {
      line = next;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (words.length && lines.length === maxLines) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s?\S*$/, '') + '…';
  }
  return lines;
}

// One static score paddle — rounded rect on a thin stick, mono eyebrow label,
// big number. Mirrors components/runway/ScorePaddles.tsx.
function paddle({ label, value, x, y = 258 }) {
  const w = 180;
  const h = 230;
  return `
  <g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="#18181b" stroke="#3f3f46"/>
    <text x="${x + w / 2}" y="${y + 44}" text-anchor="middle" font-size="15" letter-spacing="3" fill="#a1a1aa" font-family="ui-monospace, Menlo, monospace">${esc(label)}</text>
    <text x="${x + w / 2}" y="${y + 162}" text-anchor="middle" font-size="88" font-weight="bold" fill="#fafafa" font-family="Helvetica, Arial, sans-serif">${esc(value)}</text>
    <rect x="${x + w / 2 - 2}" y="${y + h}" width="4" height="40" rx="2" fill="#3f3f46"/>
  </g>`;
}

function cardSvg(result) {
  const persona = getPersona(result.persona);
  const s = result.scores || {};
  const themeLines = wrapText(result.themeName || '', 24, 2)
    .map((l, i) => `<text x="64" y="${150 + i * 60}" font-size="52" font-weight="bold" fill="#fafafa" font-family="Helvetica, Arial, sans-serif">${esc(l)}</text>`)
    .join('');
  const wrappedVerdict = wrapText(result.verdict || '', 30, 4);
  const verdictLines = wrappedVerdict
    .map((l, i) => `<text x="706" y="${310 + i * 40}" font-size="27" font-style="italic" fill="#d4d4d8" font-family="Helvetica, Arial, sans-serif">${i === 0 ? '\u201c' : ''}${esc(l)}${i === wrappedVerdict.length - 1 ? '\u201d' : ''}</text>`)
    .join('');
  const lateTag = result.late ? `<rect x="1044" y="56" width="92" height="34" rx="17" fill="#fb923c" fill-opacity="0.15" stroke="#fb923c"/><text x="1090" y="79" text-anchor="middle" font-size="18" letter-spacing="2" fill="#fb923c" font-family="ui-monospace, Menlo, monospace">LATE</text>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="spot" cx="50%" cy="0%" r="90%">
      <stop offset="0%" stop-color="#f43f5e" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="#09090b" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="#09090b"/>
  <rect width="1200" height="630" fill="url(#spot)"/>
  <text x="64" y="82" font-size="22" letter-spacing="8" fill="#f43f5e" font-family="ui-monospace, Menlo, monospace">RUNWAY</text>
  ${lateTag}
  <rect x="64" y="100" width="120" height="4" fill="#f43f5e"/>
  ${themeLines}
  <text x="1136" y="176" text-anchor="end" font-size="88" font-weight="bold" fill="#fafafa" font-family="Helvetica, Arial, sans-serif">${esc(Number(result.total).toFixed(1))}<tspan font-size="36" fill="#71717a">/10</tspan></text>
  <text x="1136" y="212" text-anchor="end" font-size="18" fill="#a1a1aa" font-family="Helvetica, Arial, sans-serif">judged by ${esc(persona.name)}</text>
  ${paddle({ label: 'THEME', value: s.theme ?? '\u2014', x: 64 })}
  ${paddle({ label: 'COHESION', value: s.cohesion ?? '\u2014', x: 264 })}
  ${paddle({ label: 'STYLING', value: s.styling ?? '\u2014', x: 464 })}
  ${verdictLines}
  <text x="1136" y="594" text-anchor="end" font-size="18" fill="#a1a1aa" font-family="Helvetica, Arial, sans-serif">Can you beat it? onpoint.trustfall.xyz/runway</text>
</svg>`;
}

router.get('/:roundId.png', async (req, res) => {
  try {
    if (!ROUND_ID_RE.test(req.params.roundId)) return res.status(400).json({ error: 'invalid round id' });
    const result = await runwayState.getResult(req.params.roundId);
    if (!result) return res.status(404).json({ error: 'Round not found' });
    const png = await sharp(Buffer.from(cardSvg(result))).png().toBuffer();
    res.set('Cache-Control', 'public, max-age=3600');
    res.set('Content-Type', 'image/png');
    return res.send(png);
  } catch (err) {
    logger.error('runway card png failed', { component: 'runway-card', error: err.message });
    return res.status(500).json({ error: 'card render failed' });
  }
});

router.get('/:roundId', async (req, res) => {
  if (!ROUND_ID_RE.test(req.params.roundId)) return res.status(404).json({ error: 'Round not found' });
  return res.redirect(302, `${webBaseUrl()}/runway/r/${req.params.roundId}`);
});

module.exports = router;
