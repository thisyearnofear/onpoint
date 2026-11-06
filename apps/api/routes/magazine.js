/**
 * Magazine Routes — /api/magazine
 *
 * A personal fashion magazine: one photo + items + names + a note → a
 * flipbook at /m/{id}. The recipient is the cover star; merch rides on
 * the inside spreads. No account, unguessable id, no price.
 *
 *   POST /api/magazine       { photoData?, recipientName?, senderName?, note?, lookSlug?|listingIds? }
 *   GET  /api/magazine/:id   → public magazine view
 */

const express = require('express');
const { eq, inArray } = require('drizzle-orm');
const { magazines, agentLooks, listings } = require('@repo/db');
const { getDb } = require('../lib/db');
const { keyToUrl } = require('../lib/r2');
const { upload: r2Upload, publicUrl: r2PublicUrl } = require('@repo/storage');
const { logFunnelEvent } = require('../lib/funnel');
const logger = require('../lib/logger');
const crypto = require('crypto');

const router = express.Router();
const ID_RE = /^[a-f0-9-]{36}$/;

async function resolveItems(db, { lookSlug, listingIds }) {
  let ids = Array.isArray(listingIds) ? listingIds.filter(Boolean).slice(0, 8) : null;
  if (!ids && lookSlug) {
    const [look] = await db.select().from(agentLooks).where(eq(agentLooks.slug, String(lookSlug))).limit(1);
    if (!look) return { items: [], notFound: true };
    ids = (look.listingIds || []).slice(0, 8);
  }
  if (!ids || ids.length === 0) return { items: [], notFound: false };
  const rows = await db.select().from(listings).where(inArray(listings.id, ids));
  return {
    notFound: false,
    items: rows.map((l) => ({
      listingId: l.id,
      curatorSlug: l.curatorSlug || null,
      title: l.title || null,
      imageUrl: l.photoKeys?.[0] ? keyToUrl(l.photoKeys[0]) : null,
    })),
  };
}

async function uploadPhoto(photoData) {
  const match = String(photoData).match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) return null;
  const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
  const key = `magazines/${crypto.randomUUID()}.${ext}`;
  await r2Upload(key, Buffer.from(match[2], 'base64'), `image/${ext}`);
  return r2PublicUrl(key);
}

const PHOTO_BYTES_MAX = 8_000_000; // ~6 MB image as base64 — the 10mb body cap stays the backstop

router.post('/', async (req, res) => {
  try {
    const { photoData, recipientName, senderName, note, lookSlug, listingIds, replyTo, heroFirst, shareId, shareChannel } = req.body || {};
    if (photoData && String(photoData).length > PHOTO_BYTES_MAX) {
      return res.status(413).json({ error: 'photo too large — under 6 MB' });
    }
    const db = getDb();
    const { items, notFound } = await resolveItems(db, { lookSlug, listingIds });
    if (notFound) return res.status(404).json({ error: 'look not found' });
    const photoUrl = photoData ? await uploadPhoto(photoData).catch(() => null) : null;

    let issue = 1;
    let parent = null;
    if (replyTo && ID_RE.test(String(replyTo))) {
      [parent] = await db.select({ issue: magazines.issue }).from(magazines).where(eq(magazines.id, String(replyTo))).limit(1);
      if (parent) issue = parent.issue + 1;
    }

    const [row] = await db
      .insert(magazines)
      .values({
        photoUrl,
        recipientName: recipientName ? String(recipientName).slice(0, 60) : null,
        senderName: senderName ? String(senderName).slice(0, 60) : null,
        note: note ? String(note).slice(0, 500) : null,
        items,
        issue,
        replyTo: parent ? String(replyTo) : null,
        heroListingId: heroFirst && items[0] ? items[0].listingId : null,
      })
      .returning({ id: magazines.id });
    await logFunnelEvent(db, {
      eventType: 'magazine_created',
      source: 'web',
      metadata: {
        id: row.id,
        count: items.length,
        surface: 'magazine',
        ...(shareId ? { shareId: String(shareId).slice(0, 24), shareChannel: String(shareChannel || 'direct').slice(0, 24) } : {}),
      },
    });
    const base = process.env.WEB_BASE_URL || 'https://onpoint.trustfall.xyz';
    res.json({ id: row.id, url: `${base}/m/${row.id}` });
  } catch (err) {
    logger.error('magazine create failed', { route: 'magazine' }, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '');
    if (!ID_RE.test(id)) return res.status(400).json({ error: 'invalid id' });
    const db = getDb();
    const [row] = await db.select().from(magazines).where(eq(magazines.id, id)).limit(1);
    if (!row) return res.status(404).json({ error: 'magazine not found' });
    await logFunnelEvent(db, { eventType: 'magazine_viewed', source: 'web', metadata: { id: row.id } });
    res.json({
      id: row.id,
      photoUrl: row.photoUrl,
      recipientName: row.recipientName,
      senderName: row.senderName,
      note: row.note,
      items: row.items || [],
      issue: row.issue,
      replyTo: row.replyTo,
      heroListingId: row.heroListingId,
      createdAt: row.createdAt,
    });
  } catch (err) {
    logger.error('magazine lookup failed', { route: 'magazine' }, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
