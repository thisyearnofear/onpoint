/**
 * Catalog Route Wrapper
 * 
 * Reuses existing logic from apps/web/lib/services/product-catalog.ts
 * by calling the Python bridge for external searches.
 */

const express = require('express');
const router = express.Router();
const { productCatalog } = require('../../lib/services/product-catalog');

// GET /api/agent/catalog?query=...&limit=10
router.get('/', async (req, res) => {
  try {
    const { query, limit = 10, refresh = 'false' } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    const result = await productCatalog.search(query, {
      limit: parseInt(limit),
      forceRefresh: refresh === 'true',
    });

    res.json({
      query,
      count: result.items.length,
      source: result.source,
      cached: result.cached,
      items: result.items,
    });
  } catch (error) {
    console.error('Catalog search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/agent/catalog (advanced search with auth)
router.post('/', async (req, res) => {
  // For now, same as GET - can add auth middleware later
  try {
    const { query, limit = 10, forceRefresh = false } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query required' });
    }

    const result = await productCatalog.search(query, {
      limit,
      forceRefresh,
    });

    res.json({
      query,
      count: result.items.length,
      source: result.source,
      cached: result.cached,
      items: result.items,
    });
  } catch (error) {
    console.error('Catalog POST error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
