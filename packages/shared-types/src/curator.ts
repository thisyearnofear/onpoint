/**
 * Curator — single primitive for human merchants and AI personas.
 *
 * See ADR 0002: https://github.com/thisyearnofear/onpoint/blob/master/docs/adr/0002-curator-primitive.md
 *
 * A Curator is anyone (human or AI) with a name, a voice, a catalog, and
 * a point of view. Both Wanja-the-jersey-stylist and Miranda-the-AI-persona
 * are Curators differing only in `type`.
 *
 * The schema is intentionally mostly optional so a sole trader like Wanja
 * (no logo, no brand book) onboards without friction; defaults are provided
 * by the storefront renderer.
 */

export type CuratorType = "human" | "ai";

export interface Curator {
  /** URL slug for the storefront: /s/{slug} */
  slug: string;

  /** Display name (e.g. "Wanja", "Miranda Priestly") */
  name: string;

  /** Human merchant or AI persona */
  type: CuratorType;

  /** Avatar image URL (optional — defaults to initials) */
  avatar?: string;

  /** For AI: prompt seed. For humans: bio sample or voice description */
  voice?: string;

  /** Vertical tags — ["football", "streetwear", "formal", ...] */
  verticals: string[];

  /** Other Curator slugs this Curator collaborates with */
  collaborators?: string[];

  /** Inbound/outbound messaging channels.
   *  The admin surface for a human Curator is a chat (Spectrum-ts), not a CMS. */
  channels?: {
    whatsapp?: string;   // E.164, e.g. "+254712345678"
    telegram?: string;
    instagram?: string;
  };

  /** Branding — all optional. Renderer supplies tasteful defaults. */
  brand?: {
    logo?: string;
    colors?: { primary?: string; accent?: string };
    frameTemplate?: string;       // polaroid frame id
    shareCopy?: string;           // template w/ {team}, {curator}
    location?: { city: string; landmark?: string };
  };

  /** Commerce / checkout configuration */
  commerce?: {
    checkout: "whatsapp" | "shopify" | "stripe";
    /** URL for shopify / stripe checkout */
    checkoutUrl?: string;
    /** Prefill template for wa.me deep link */
    whatsappTemplate?: string;
    /** Revenue share fraction (0..1 of attributed sales) */
    revShare?: number;
    /** M-Pesa till/paybill number */
    mpesaNumber?: string;
    /** Celo wallet address for G$ streaming subscriptions (Superfluid). */
    walletAddress?: `0x${string}`;
  };
}

/**
 * Premier League Kit SKU — backbone shared reference data.
 * Wanja types "+ arsenal home M 2500 4" and the agent resolves
 * "arsenal home" → KitSKU.id = "arsenal-2425-home", creates a listing.
 *
 * Lives here as a type; the actual rows live in Neon's `kit_skus` table.
 */
export interface KitSKU {
  id: string;                     // "arsenal-2425-home"
  club: string;                   // "Arsenal"
  season: string;                 // "2024/25"
  kitType: "home" | "away" | "third" | "goalkeeper";
  officialImageKey?: string;      // R2 key, e.g. "kits/arsenal-2425-home.jpg"
  crestKey?: string;              // R2 key for club crest
}

/**
 * Listing — a Curator's inventory item, referencing a KitSKU.
 * Created when Wanja texts "+ arsenal home M 2500 4" + photo.
 */
export interface Listing {
  id: string;                     // UUID
  curatorSlug: string;
  skuId: string;                  // references KitSKU.id
  sizes: Array<{
    size: string;
    stock: number;
    price: number;
    printingAvailable?: boolean;
    printingPrice?: number;
  }>;
  photoKeys: string[];            // R2 keys — override official kit image
  status: "live" | "paused" | "archived";
  createdAt: string;
  updatedAt: string;
}

/**
 * Order — a customer purchase initiated from a storefront.
 */
export interface Order {
  id: string;                     // UUID
  curatorSlug: string;
  listingId: string;
  size: string;
  customerPhone?: string;
  source: "whatsapp_deeplink" | "site_buy";
  status: "pending" | "confirmed" | "fulfilled" | "cancelled";
  createdAt: string;
}

/**
 * Session — a customer try-on session on a Curator's storefront.
 */
export interface Session {
  id: string;                     // UUID
  curatorSlug: string;
  visitorHash?: string;           // analytics, no PII
  tryOnImageKey?: string;         // R2 key
  polaroidKey?: string;           // R2 key for share asset
  shared: boolean;
  createdAt: string;
}

/**
 * Storefront Response — the shape returned by GET /api/curator/:slug/storefront.
 */
export interface CuratorStorefrontResponse {
  curator: Curator;
  listings: Array<{
    id: string;
    sizes: Array<{
      size: string;
      stock: number;
      price: number;
      printingAvailable?: boolean;
      printingPrice?: number;
    }>;
    imageUrl: string | null;
    checkoutUrl: string | null;
    kit: {
      club: string;
      season: string;
      kitType: string;
      crestUrl: string | null;
    };
  }>;
  meta: {
    listingCount: number;
    checkout: string;
  };
}
