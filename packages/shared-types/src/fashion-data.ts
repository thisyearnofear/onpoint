/**
 * Fashion Data Source
 *
 * Centralized, type-safe fashion item definitions
 * Modeled after astro-shop's clean data pattern
 *
 * This is the single source of truth for:
 * - Product catalog
 * - Styling canvas items
 * - NFT metadata
 * - Virtual try-on references
 */

import type { FashionItem, FashionCategory } from "./index";
import { FashionCategory as FC } from "./fashion-category";

/**
 * Core styling canvas items - these are the draggable items in InteractiveStylingCanvas
 */
export const CANVAS_ITEMS: FashionItem[] = [
  // ── Shirts ──
  {
    id: "1",
    slug: "t-705-shirt-brave",
    name: "Ratphex-T",
    description: "Bold graphic tee with streetwear aesthetic",
    price: 129,
    category: FC.Shirts,
    cover:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=500&fit=crop",
    productSrc:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=500&fit=crop",
    modelSrc:
      "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=400&h=500&fit=crop",
    modelSize: "L",
    modelHeight: "5'4\"",
    createdAt: new Date(),
    updatedAt: new Date(),
    averageRating: 4.5,
  },
  {
    id: "2",
    slug: "ratward-scissor-t",
    name: "RatwardScissor-T",
    description: "Minimalist geometric design with clean lines",
    price: 99,
    category: FC.Shirts,
    cover:
      "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=400&h=500&fit=crop",
    productSrc:
      "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=400&h=500&fit=crop",
    modelSrc:
      "https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?w=400&h=500&fit=crop",
    modelSize: "XL",
    modelHeight: "5'4\"",
    createdAt: new Date(),
    updatedAt: new Date(),
    averageRating: 4.2,
  },
  {
    id: "3",
    slug: "animal-collective-t",
    name: "AnimalCollective-T",
    description: "Vintage-inspired animal graphics on premium cotton",
    price: 79,
    category: FC.Shirts,
    cover:
      "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400&h=500&fit=crop",
    productSrc:
      "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400&h=500&fit=crop",
    modelSrc:
      "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=400&h=500&fit=crop",
    modelSize: "S",
    modelHeight: "5'4\"",
    createdAt: new Date(),
    updatedAt: new Date(),
    averageRating: 4.8,
  },
  {
    id: "4",
    slug: "mono-oversized-tee",
    name: "Mono Oversized Tee",
    description: "Relaxed fit cotton tee in monochrome wash",
    price: 65,
    category: FC.Shirts,
    cover:
      "https://images.unsplash.com/photo-1622445275463-afa2ab738c34?w=400&h=500&fit=crop",
    productSrc:
      "https://images.unsplash.com/photo-1622445275463-afa2ab738c34?w=400&h=500&fit=crop",
    modelSize: "M",
    modelHeight: "5'8\"",
    createdAt: new Date(),
    updatedAt: new Date(),
    averageRating: 4.0,
  },

  // ── Pants ──
  {
    id: "5",
    slug: "wide-leg-cargo-trouser",
    name: "Wide Leg Cargo",
    description: "Relaxed wide-leg cargo with utility pockets",
    price: 145,
    category: FC.Pants,
    cover:
      "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=400&h=500&fit=crop",
    productSrc:
      "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=400&h=500&fit=crop",
    modelSize: "32",
    createdAt: new Date(),
    updatedAt: new Date(),
    averageRating: 4.3,
  },
  {
    id: "6",
    slug: "slim-tapered-denim",
    name: "Slim Tapered Denim",
    description: "Classic slim fit with tapered leg in dark indigo",
    price: 115,
    category: FC.Pants,
    cover:
      "https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&h=500&fit=crop",
    productSrc:
      "https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&h=500&fit=crop",
    modelSize: "30",
    createdAt: new Date(),
    updatedAt: new Date(),
    averageRating: 4.6,
  },

  // ── Shoes ──
  {
    id: "7",
    slug: "chunky-platform-sneaker",
    name: "Chunky Platform Sneaker",
    description: "Elevated sole sneaker with retro paneling",
    price: 185,
    category: FC.Shoes,
    cover:
      "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&h=500&fit=crop",
    productSrc:
      "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&h=500&fit=crop",
    modelSize: "10",
    createdAt: new Date(),
    updatedAt: new Date(),
    averageRating: 4.7,
  },
  {
    id: "8",
    slug: "minimalist-leather-loafer",
    name: "Minimalist Leather Loafer",
    description: "Clean silhouette loafer in smooth leather",
    price: 165,
    category: FC.Shoes,
    cover:
      "https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?w=400&h=500&fit=crop",
    productSrc:
      "https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?w=400&h=500&fit=crop",
    modelSize: "9",
    createdAt: new Date(),
    updatedAt: new Date(),
    averageRating: 4.4,
  },

  // ── Accessories ──
  {
    id: "9",
    slug: "silver-chain-necklace",
    name: "Silver Chain Necklace",
    description: "Chunky curb chain in sterling silver finish",
    price: 55,
    category: FC.Accessories,
    cover:
      "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=400&h=500&fit=crop",
    productSrc:
      "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=400&h=500&fit=crop",
    createdAt: new Date(),
    updatedAt: new Date(),
    averageRating: 4.1,
  },
  {
    id: "10",
    slug: "leather-crossbody-bag",
    name: "Leather Crossbody Bag",
    description: "Compact crossbody in textured vegan leather",
    price: 89,
    category: FC.Accessories,
    cover:
      "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&h=500&fit=crop",
    productSrc:
      "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&h=500&fit=crop",
    createdAt: new Date(),
    updatedAt: new Date(),
    averageRating: 4.5,
  },

  // ── Outerwear ──
  {
    id: "11",
    slug: "oversized-bomber-jacket",
    name: "Oversized Bomber Jacket",
    description: "Boxy bomber in nylon with ribbed cuffs",
    price: 210,
    category: FC.Outerwear,
    cover:
      "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400&h=500&fit=crop",
    productSrc:
      "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400&h=500&fit=crop",
    modelSrc:
      "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&h=500&fit=crop",
    modelSize: "L",
    modelHeight: "5'10\"",
    createdAt: new Date(),
    updatedAt: new Date(),
    averageRating: 4.6,
  },
  {
    id: "12",
    slug: "cropped-puffer-vest",
    name: "Cropped Puffer Vest",
    description: "Lightweight cropped puffer with matte finish",
    price: 135,
    category: FC.Outerwear,
    cover:
      "https://images.unsplash.com/photo-1544022613-e87ca75a784a?w=400&h=500&fit=crop",
    productSrc:
      "https://images.unsplash.com/photo-1544022613-e87ca75a784a?w=400&h=500&fit=crop",
    modelSize: "M",
    createdAt: new Date(),
    updatedAt: new Date(),
    averageRating: 4.3,
  },

  // ── Dresses ──
  {
    id: "13",
    slug: "asymmetric-midi-dress",
    name: "Asymmetric Midi Dress",
    description: "Draped midi with asymmetric hem in jersey",
    price: 175,
    category: FC.Dresses,
    cover:
      "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400&h=500&fit=crop",
    productSrc:
      "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400&h=500&fit=crop",
    modelSrc:
      "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=400&h=500&fit=crop",
    modelSize: "S",
    modelHeight: "5'6\"",
    createdAt: new Date(),
    updatedAt: new Date(),
    averageRating: 4.9,
  },

  // ── Additional Products for Expanded Catalog ──
  // ── Jackets ──
  {
    id: "14",
    slug: "cropped-utility-jacket",
    name: "Cropped Utility Jacket",
    description: "Multi-pocket cropped jacket in olive green",
    price: 120,
    category: FC.Outerwear,
    cover: "/assets/1Product.png",
    productSrc: "/assets/1Product.png",
    modelSrc: "/assets/1Model.png",
    modelSize: "M",
    modelHeight: "5'6\"",
    createdAt: new Date(),
    updatedAt: new Date(),
    averageRating: 4.4,
  },
  {
    id: "15",
    slug: "denim-trucker-jacket",
    name: "Denim Trucker Jacket",
    description: "Classic wash denim jacket with button front",
    price: 95,
    category: FC.Outerwear,
    cover: "/assets/2Product.png",
    productSrc: "/assets/2Product.png",
    modelSrc: "/assets/2Model.png",
    modelSize: "L",
    modelHeight: "5'8\"",
    createdAt: new Date(),
    updatedAt: new Date(),
    averageRating: 4.6,
  },
  {
    id: "16",
    slug: "blazer-noir",
    name: "Blazer Noir",
    description: "Tailored single-breasted blazer in black",
    price: 185,
    category: FC.Outerwear,
    cover: "/assets/3Product.png",
    productSrc: "/assets/3Product.png",
    modelSrc: "/assets/3Model.png",
    modelSize: "S",
    modelHeight: "5'4\"",
    createdAt: new Date(),
    updatedAt: new Date(),
    averageRating: 4.7,
  },

  // ── Shoes ──
  {
    id: "17",
    slug: "chunky-Platform-sneaker",
    name: "Chunky Platform Sneaker",
    description: "High-platform sneaker in white with black accents",
    price: 110,
    category: FC.Shoes,
    cover: "/assets/1Product.png",
    productSrc: "/assets/1Product.png",
    modelSize: "38",
    createdAt: new Date(),
    updatedAt: new Date(),
    averageRating: 4.3,
  },
  {
    id: "18",
    slug: "leather-ankle-boot",
    name: "Leather Ankle Boot",
    description: "Pointed-toe ankle boot in tan leather",
    price: 145,
    category: FC.Shoes,
    cover: "/assets/2Product.png",
    productSrc: "/assets/2Product.png",
    modelSize: "37",
    createdAt: new Date(),
    updatedAt: new Date(),
    averageRating: 4.5,
  },
  {
    id: "19",
    slug: "loafer-minimal",
    name: "Loafer Minimal",
    description: "Slip-on loafer in black patent leather",
    price: 89,
    category: FC.Shoes,
    cover: "/assets/3Product.png",
    productSrc: "/assets/3Product.png",
    modelSize: "39",
    createdAt: new Date(),
    updatedAt: new Date(),
    averageRating: 4.2,
  },

  // ── Bags ──
  {
    id: "20",
    slug: "mini-crossbody",
    name: "Mini Crossbody",
    description: "Compact crossbody bag in cream canvas",
    price: 65,
    category: FC.Accessories,
    cover: "/assets/1Product.png",
    productSrc: "/assets/1Product.png",
    createdAt: new Date(),
    updatedAt: new Date(),
    averageRating: 4.1,
  },
  {
    id: "21",
    slug: "tote-canvas",
    name: "Canvas Tote",
    description: "Large canvas tote with leather handles",
    price: 75,
    category: FC.Accessories,
    cover: "/assets/2Product.png",
    productSrc: "/assets/2Product.png",
    createdAt: new Date(),
    updatedAt: new Date(),
    averageRating: 4.4,
  },

  // ── Accessories ──
  {
    id: "22",
    slug: "silk-scarf",
    name: "Silk Scarf",
    description: "Printed silk scarf with geometric pattern",
    price: 55,
    category: FC.Accessories,
    cover: "/assets/1Product.png",
    productSrc: "/assets/1Product.png",
    createdAt: new Date(),
    updatedAt: new Date(),
    averageRating: 4.8,
  },
  {
    id: "23",
    slug: "leather-belt",
    name: "Leather Belt",
    description: "Classic leather belt with silver buckle",
    price: 45,
    category: FC.Accessories,
    cover: "/assets/2Product.png",
    productSrc: "/assets/2Product.png",
    createdAt: new Date(),
    updatedAt: new Date(),
    averageRating: 4.3,
  },
  {
    id: "24",
    slug: "cat-eye-sunglasses",
    name: "Cat Eye Sunglasses",
    description: "Vintage-inspired cat eye sunglasses",
    price: 35,
    category: FC.Accessories,
    cover: "/assets/3Product.png",
    productSrc: "/assets/3Product.png",
    createdAt: new Date(),
    updatedAt: new Date(),
    averageRating: 4.0,
  },
];

/**
 * Get a fashion item by ID
 * @param id - Fashion item ID
 * @returns Fashion item or undefined
 */
export function getFashionItemById(id: string): FashionItem | undefined {
  return CANVAS_ITEMS.find((item) => item.id === id);
}

/**
 * Get a fashion item by slug (for URL routing)
 * @param slug - URL-friendly identifier
 * @returns Fashion item or undefined
 */
export function getFashionItemBySlug(slug: string): FashionItem | undefined {
  return CANVAS_ITEMS.find((item) => item.slug === slug);
}

/**
 * Get all fashion items in a category
 * @param category - Fashion category
 * @returns Array of fashion items
 */
export function getFashionItemsByCategory(
  category: FashionCategory,
): FashionItem[] {
  return CANVAS_ITEMS.filter((item) => item.category === category);
}

/**
 * Get transition name for View Transitions API
 * Unique per item to enable smooth morphing between views
 *
 * @param itemId - Fashion item ID
 * @param element - What element to transition (image, title, price, etc)
 * @returns Transition name string
 */
export function getTransitionName(
  itemId: string,
  element: "image" | "title" | "description" | "price",
): string {
  return `fashion-item-${itemId}-${element}`;
}

/**
 * Get all canvas items sorted by category
 */
export function getCanvasItemsByCategory(): Record<string, FashionItem[]> {
  const grouped: Record<string, FashionItem[]> = {};

  CANVAS_ITEMS.forEach((item) => {
    if (!grouped[item.category]) {
      grouped[item.category] = [];
    }
    grouped[item.category]!.push(item);
  });

  return grouped;
}

/**
 * African Pattern Type
 */
interface AfricanPattern {
  name: string;
  origin: string;
  characteristics: string;
  culturalSignificance: string;
  colorPalette: readonly string[];
}

/**
 * African Pattern Library
 *
 * Cultural pattern data for African-inspired designs
 * Used by AI generator and styling suggestions
 */
export const AFRICAN_PATTERNS: readonly AfricanPattern[] = [
  {
    name: "Ankara",
    origin: "West Africa",
    characteristics: "Vibrant wax prints with bold geometric patterns",
    culturalSignificance: "Celebratory wear, everyday fashion",
    colorPalette: ["#FF5722", "#FF9800", "#4CAF50", "#2196F3"],
  },
  {
    name: "Kente",
    origin: "Ghana (Ashanti)",
    characteristics: "Woven silk strips with intricate geometric designs",
    culturalSignificance: "Royalty, special occasions, cultural pride",
    colorPalette: ["#FFD700", "#FF4500", "#008000", "#000080"],
  },
  {
    name: "Adire",
    origin: "Yoruba (Nigeria)",
    characteristics: "Indigo tie-dye with white resist patterns",
    culturalSignificance: "Traditional craftsmanship, spiritual patterns",
    colorPalette: ["#1A237E", "#FFFFFF", "#5D4037"],
  },
  {
    name: "Bogolan",
    origin: "Mali (Bambara)",
    characteristics: "Mud-cloth with earthy tones and symbolic motifs",
    culturalSignificance: "Rites of passage, storytelling through patterns",
    colorPalette: ["#5D4037", "#8D6E63", "#FFFFFF", "#3E2723"],
  },
  {
    name: "Shweshwe",
    origin: "South Africa",
    characteristics:
      "Printed cotton with intricate floral and geometric designs",
    culturalSignificance: "Traditional attire, cultural identity",
    colorPalette: ["#8E24AA", "#3F51B5", "#009688", "#FFC107"],
  },
];

/**
 * Get African pattern by name
 * @param name - Pattern name
 * @returns African pattern data or undefined
 */
export function getAfricanPatternByName(
  name: string,
): AfricanPattern | undefined {
  return AFRICAN_PATTERNS.find((pattern) => pattern.name === name);
}

/**
 * Get random African pattern for AI inspiration
 * @returns Random African pattern
 */
export function getRandomAfricanPattern(): AfricanPattern | undefined {
  return AFRICAN_PATTERNS[Math.floor(Math.random() * AFRICAN_PATTERNS.length)];
}

/**
 * Style preferences for recommendation scoring
 */
export interface StylePreferences {
  categories: string[];
  priceRange: { min: number; max: number };
  colors?: string[];
}

/**
 * Score and rank items by style preferences.
 * Returns items sorted by relevance (highest score first).
 *
 * @param prefs - User's tracked style preferences
 * @param limit - Max items to return
 * @param excludeIds - Item IDs to skip (e.g., already in cart)
 */
export function getRecommendedItems(
  prefs: StylePreferences,
  limit = 3,
  excludeIds: string[] = [],
): FashionItem[] {
  const scored = CANVAS_ITEMS.filter((item) => !excludeIds.includes(item.id))
    .map((item) => {
      let score = 0;

      // Category match (strongest signal)
      if (prefs.categories.length > 0) {
        if (prefs.categories.includes(item.category)) {
          score += 10;
        }
      }

      // Price range match
      if (
        item.price >= prefs.priceRange.min &&
        item.price <= prefs.priceRange.max
      ) {
        score += 5;
      }

      // Rating bonus
      score += item.averageRating ?? 0;

      // Slight randomness for variety
      score += Math.random() * 0.5;

      return { item, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => s.item);
}
