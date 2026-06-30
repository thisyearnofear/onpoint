/**
 * KarmaGAP API Routes
 * Provides access to projects, grants, and Hermes AI agent management
 */

const express = require('express');
const router = express.Router();
const logger = require('../lib/logger');

const KARMA_GAP_API_KEY = process.env.KARMA_GAP_API_KEY;
const KARMA_GAP_BASE_URL = process.env.KARMA_GAP_BASE_URL || 'https://gapapi.karmahq.xyz/v2';

// ── Helper: Fetch from KarmaGAP API ──

async function karmaFetch(endpoint, options = {}) {
  if (!KARMA_GAP_API_KEY) {
    throw new Error('KARMA_GAP_API_KEY not configured');
  }

  const url = `${KARMA_GAP_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'x-api-key': KARMA_GAP_API_KEY,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: 'RequestFailed',
      message: `HTTP ${response.status}: ${response.statusText}`,
    }));
    throw new Error(`KarmaGAP API Error: ${error.message || error.error}`);
  }

  return response.json();
}

// ── GET /api/karmagap/projects ──
// List/search projects with filtering and pagination

router.get('/projects', async (req, res) => {
  try {
    const { page, limit, search, tags, chainID, sortBy, sortOrder } = req.query;

    const searchParams = new URLSearchParams();
    if (page) searchParams.set('page', page);
    if (limit) searchParams.set('limit', limit);
    if (search) searchParams.set('search', search);
    if (chainID) searchParams.set('chainID', chainID);
    if (sortBy) searchParams.set('sortBy', sortBy);
    if (sortOrder) searchParams.set('sortOrder', sortOrder);
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      tagArray.forEach((tag) => searchParams.append('tags', tag));
    }

    const query = searchParams.toString();
    const data = await karmaFetch(`/projects${query ? `?${query}` : ''}`);

    res.json(data);
  } catch (error) {
    logger.error('[KarmaGAP] Projects list error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/karmagap/projects/:identifier ──
// Get project by UID or slug

router.get('/projects/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const data = await karmaFetch(`/projects/${identifier}`);
    res.json(data);
  } catch (error) {
    logger.error('[KarmaGAP] Project fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/karmagap/projects/:identifier/milestones ──
// Get project milestones

router.get('/projects/:identifier/milestones', async (req, res) => {
  try {
    const { identifier } = req.params;
    const data = await karmaFetch(`/projects/${identifier}/milestones`);
    res.json(data);
  } catch (error) {
    logger.error('[KarmaGAP] Milestones fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/karmagap/projects/:identifier/grants ──
// Get project grants

router.get('/projects/:identifier/grants', async (req, res) => {
  try {
    const { identifier } = req.params;
    const data = await karmaFetch(`/projects/${identifier}/grants`);
    res.json(data);
  } catch (error) {
    logger.error('[KarmaGAP] Grants fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/karmagap/projects/:identifier/updates ──
// Get project updates and activities

router.get('/projects/:identifier/updates', async (req, res) => {
  try {
    const { identifier } = req.params;
    const data = await karmaFetch(`/projects/${identifier}/updates`);
    res.json(data);
  } catch (error) {
    logger.error('[KarmaGAP] Updates fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/karmagap/hermes/orgs/:slug ──
// Get Hermes org metadata

router.get('/hermes/orgs/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const data = await karmaFetch(`/hermes/orgs/${slug}`);
    res.json(data);
  } catch (error) {
    logger.error('[KarmaGAP] Hermes org fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── POST /api/karmagap/hermes/orgs/:slug/provision ──
// Provision Hermes container for organization

router.post('/hermes/orgs/:slug/provision', async (req, res) => {
  try {
    const { slug } = req.params;
    const data = await karmaFetch(`/hermes/orgs/${slug}/provision`, {
      method: 'POST',
    });
    res.json(data);
  } catch (error) {
    logger.error('[KarmaGAP] Hermes provision error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/karmagap/hermes/orgs/:slug/profiles ──
// List Hermes profiles in org

router.get('/hermes/orgs/:slug/profiles', async (req, res) => {
  try {
    const { slug } = req.params;
    const data = await karmaFetch(`/hermes/orgs/${slug}/profiles`);
    res.json(data);
  } catch (error) {
    logger.error('[KarmaGAP] Hermes profiles fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/karmagap/hermes/orgs/:slug/brain/:topic ──
// Read structured org brain data

router.get('/hermes/orgs/:slug/brain/:topic', async (req, res) => {
  try {
    const { slug, topic } = req.params;
    const data = await karmaFetch(`/hermes/orgs/${slug}/brain/${topic}`);
    res.json(data);
  } catch (error) {
    logger.error('[KarmaGAP] Hermes brain fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── PUT /api/karmagap/hermes/orgs/:slug/brain/:topic ──
// Save structured org brain data

router.put('/hermes/orgs/:slug/brain/:topic', async (req, res) => {
  try {
    const { slug, topic } = req.params;
    const data = await karmaFetch(`/hermes/orgs/${slug}/brain/${topic}`, {
      method: 'PUT',
      body: JSON.stringify(req.body),
    });
    res.json(data);
  } catch (error) {
    logger.error('[KarmaGAP] Hermes brain save error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/karmagap/hermes/orgs/:slug/work/tasks ──
// List Hermes tasks

router.get('/hermes/orgs/:slug/work/tasks', async (req, res) => {
  try {
    const { slug } = req.params;
    const data = await karmaFetch(`/hermes/orgs/${slug}/work/tasks`);
    res.json(data);
  } catch (error) {
    logger.error('[KarmaGAP] Hermes tasks fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── POST /api/karmagap/hermes/orgs/:slug/work/tasks ──
// Create Hermes task

router.post('/hermes/orgs/:slug/work/tasks', async (req, res) => {
  try {
    const { slug } = req.params;
    const data = await karmaFetch(`/hermes/orgs/${slug}/work/tasks`, {
      method: 'POST',
      body: JSON.stringify(req.body),
    });
    res.json(data);
  } catch (error) {
    logger.error('[KarmaGAP] Hermes task creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/karmagap/user/me ──
// Get current authenticated user

router.get('/user/me', async (req, res) => {
  try {
    const data = await karmaFetch('/user/me');
    res.json(data);
  } catch (error) {
    logger.error('[KarmaGAP] User fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
