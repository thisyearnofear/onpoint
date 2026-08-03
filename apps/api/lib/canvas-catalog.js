/**
 * CANVAS_ITEMS product catalog — single source of truth.
 *
 * Removes the `Object.fromEntries((sharedTypes.CANVAS_ITEMS || []).map(...))`
 * block duplicated across agent-checkout.js (by id), agent-purchase.js
 * (by slug), and curated-shop.js. The seller wallet is resolved lazily
 * through lib/wallets.js (fail-loud) rather than captured from a
 * hardcoded `PLATFORM_WALLET || '0x5b33...'` fallback at module load.
 */

const sharedTypes = require('@onpoint/shared-types');
const { getAgentWallet } = require('./wallets');

let _byId = null;
let _bySlug = null;

function build() {
  const seller = getAgentWallet();
  const items = Array.isArray(sharedTypes.CANVAS_ITEMS) ? sharedTypes.CANVAS_ITEMS : [];

  _byId = Object.fromEntries(
    items.map((item) => [
      item.id,
      {
        id: item.id,
        slug: item.slug,
        name: item.name,
        price: item.price,
        category: item.category,
        seller,
      },
    ]),
  );

  _bySlug = Object.fromEntries(
    items.map((item) => [
      item.slug,
      {
        id: item.slug,
        name: item.name,
        price: item.price.toString(),
        seller,
        category: item.category,
      },
    ]),
  );
}

function ensureBuilt() {
  if (_byId === null) build();
}

/** Get a product by its canvas id (checkout shape). */
function getProductById(id) {
  ensureBuilt();
  return _byId[id] || null;
}

/** Get a product by its slug. */
function getProductBySlug(slug) {
  ensureBuilt();
  return _bySlug[slug] || null;
}

/**
 * All products (optionally filtered by category).
 *
 * Preserve the historical purchase-list response shape: ids are slugs and
 * prices are strings. Checkout continues to use the id-indexed projection.
 */
function allProducts(category) {
  ensureBuilt();
  const all = Object.values(_bySlug);
  return category ? all.filter((p) => p.category === category) : all;
}

/** Raw CANVAS_ITEMS (for routes that only need the data, not a seller). */
function canvasItems() {
  return Array.isArray(sharedTypes.CANVAS_ITEMS) ? sharedTypes.CANVAS_ITEMS : [];
}

module.exports = {
  getProductById,
  getProductBySlug,
  allProducts,
  canvasItems,
  _rebuild: build,
};
