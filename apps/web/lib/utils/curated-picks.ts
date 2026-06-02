import {
  CANVAS_ITEMS,
  type FashionItem,
  type ExternalProduct,
  type StylePreferences,
} from "@onpoint/shared-types";

export interface CuratedPick {
  source: "local" | "external";
  item: FashionItem | ExternalProduct;
  reason: string;
  triggeredBy: string;
}

export interface CurationContext {
  score: number;
  takeaways: string[];
  topics: string[];
  persona?: string;
  sessionGoal?: string;
  recommendations?: Array<{ name: string; price: number; category: string }>;
  stylePreferences?: StylePreferences;
}

const PERSONA_QUERY_MODIFIERS: Record<string, string> = {
  luxury: "designer luxury",
  streetwear: "streetwear urban",
  sustainable: "sustainable ethical",
  miranda: "professional polished",
  edina: "bold statement",
  shaft: "classic versatile",
};

const TOPIC_CATEGORY_MAP: Record<string, string[]> = {
  "Color Harmony": ["shirts", "dresses", "accessories"],
  "Fit & Proportion": ["pants", "shirts", "dresses"],
  "Accessories": ["accessories", "shoes"],
  "Layering": ["outerwear", "shirts"],
  "Footwear": ["shoes"],
  "Silhouette": ["dresses", "pants", "outerwear"],
  "Texture & Fabric": ["shirts", "outerwear", "dresses"],
  "Pattern Mixing": ["shirts", "dresses", "accessories"],
};

const GOAL_MODIFIERS: Record<string, string> = {
  event: "for a special event",
  daily: "for everyday wear",
  critique: "to elevate my wardrobe",
};

export function scoreLocalPicks(
  ctx: CurationContext,
  limit = 5,
): CuratedPick[] {
  const takeawayKeywords = ctx.takeaways
    .join(" ")
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);

  const topicCategories = ctx.topics.flatMap(
    (topic) => TOPIC_CATEGORY_MAP[topic] || [],
  );

  const scored = CANVAS_ITEMS.map((item) => {
    let score = 0;
    let triggeredBy = "";

    const itemText = `${item.name} ${item.description} ${item.category}`.toLowerCase();

    for (const kw of takeawayKeywords) {
      if (itemText.includes(kw)) {
        score += 8;
        if (!triggeredBy) triggeredBy = kw;
      }
    }

    if (topicCategories.includes(item.category)) {
      score += 6;
      if (!triggeredBy) triggeredBy = ctx.topics.find((t) => TOPIC_CATEGORY_MAP[t]?.includes(item.category)) || "";
    }

    if (ctx.stylePreferences?.categories.includes(item.category)) {
      score += 10;
    }
    if (
      ctx.stylePreferences?.priceRange &&
      item.price >= ctx.stylePreferences.priceRange.min &&
      item.price <= ctx.stylePreferences.priceRange.max
    ) {
      score += 5;
    }

    score += item.averageRating ?? 0;
    score += Math.random() * 0.5;

    const reason = triggeredBy
      ? `Matches your ${triggeredBy} feedback`
      : `Complements your ${item.category} style`;

    return { item, score, triggeredBy, reason };
  })
    .filter((s) => s.score > 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((s) => ({
    source: "local" as const,
    item: s.item,
    reason: s.reason,
    triggeredBy: s.triggeredBy,
  }));
}

export function buildSearchQueries(
  ctx: CurationContext,
  max = 3,
): string[] {
  const queries: string[] = [];

  const itemKeywords = extractItemKeywords(ctx.takeaways);
  const personaMod = ctx.persona
    ? PERSONA_QUERY_MODIFIERS[ctx.persona] || ""
    : "";
  const goalMod = ctx.sessionGoal
    ? GOAL_MODIFIERS[ctx.sessionGoal] || ""
    : "";

  for (const keyword of itemKeywords) {
    if (queries.length >= max) break;
    const parts = [personaMod, keyword, goalMod].filter(Boolean);
    queries.push(parts.join(" ").trim());
  }

  if (queries.length === 0 && ctx.topics.length > 0) {
    const firstTopic = ctx.topics[0]!;
    const topicQuery = [personaMod, firstTopic.toLowerCase(), goalMod]
      .filter(Boolean)
      .join(" ")
      .trim();
    if (topicQuery) queries.push(topicQuery);
  }

  return queries.slice(0, max);
}

function extractItemKeywords(takeaways: string[]): string[] {
  const clothingTerms = [
    "jacket", "blazer", "coat", "shirt", "blouse", "top", "tee",
    "pants", "trousers", "jeans", "denim", "dress", "skirt",
    "shoes", "sneakers", "boots", "heels", "loafers", "sandals",
    "bag", "purse", "tote", "accessories", "watch", "jewelry",
    "sweater", "hoodie", "cardigan", "scarf", "belt", "hat",
    "outerwear", "knitwear", "suit", "shorts",
  ];

  const text = takeaways.join(" ").toLowerCase();
  const found: string[] = [];

  for (const term of clothingTerms) {
    if (text.includes(term) && !found.includes(term)) {
      found.push(term);
    }
  }

  if (found.length === 0) {
    const words = text
      .split(/\s+/)
      .filter((w) => w.length > 4 && !STOP_WORDS.has(w));
    return words.slice(0, 3);
  }

  return found.slice(0, 3);
}

const STOP_WORDS = new Set([
  "about", "after", "again", "against", "because", "being", "below",
  "between", "could", "during", "every", "first", "found", "from",
  "great", "having", "here", "into", "just", "like", "look",
  "make", "many", "might", "more", "much", "next", "only", "other",
  "overall", "really", "right", "said", "same", "seem", "should",
  "since", "some", "still", "such", "than", "that", "their", "them",
  "then", "there", "these", "they", "this", "those", "through",
  "today", "together", "toward", "under", "upon", "very", "want",
  "wear", "well", "were", "what", "when", "where", "which", "while",
  "will", "with", "within", "would", "your", "yours",
]);
