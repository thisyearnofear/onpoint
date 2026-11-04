/**
 * Curated outfit references (public/demo/outfits/*).
 * AI-generated flat-lay styling references from the MIT-licensed nvzhuang
 * dataset — see public/demo/README.md for credit. These are inspiration,
 * not purchasable inventory. Tags reuse the Runway theme vocabulary
 * (apps/api/lib/runway/themes.js). Mirrored in apps/api/lib/runway/style-board.js.
 */
export interface StyleOutfit {
  id: string;
  title: string;
  tags: string[];
  src: string;
}

export const STYLE_OUTFITS: StyleOutfit[] = [
  { id: "spr-0001", title: "Frill knit + denim mini", tags: ["spring", "casual", "weekend"], src: "/demo/outfits/spr-0001.webp" },
  { id: "spr-0002", title: "Floral cami + pink pleats", tags: ["spring", "summer", "casual", "date"], src: "/demo/outfits/spr-0002.webp" },
  { id: "spr-0161", title: "Navy cardigan + jeans", tags: ["casual", "weekend", "classic", "relaxed"], src: "/demo/outfits/spr-0161.webp" },
  { id: "spr-0166", title: "Asymmetric top + grey cargos", tags: ["casual", "streetwear", "weekend"], src: "/demo/outfits/spr-0166.webp" },
  { id: "spr-0199", title: "Grey hoodie + jeans", tags: ["streetwear", "casual", "sport", "travel", "weekend"], src: "/demo/outfits/spr-0199.webp" },
  { id: "spr-0217", title: "Crisp shirt + beige trousers", tags: ["business", "office", "work", "elegant", "classic"], src: "/demo/outfits/spr-0217.webp" },
  { id: "spr-0232", title: "Blue shirt + black jeans", tags: ["casual", "weekend", "date", "streetwear"], src: "/demo/outfits/spr-0232.webp" },
  { id: "spr-0248", title: "Layered hoodie + jacket", tags: ["streetwear", "casual", "travel", "fall"], src: "/demo/outfits/spr-0248.webp" },
  { id: "sum-0001", title: "Orange top + yellow pop", tags: ["summer", "casual", "party", "streetwear"], src: "/demo/outfits/sum-0001.webp" },
  { id: "sum-0014", title: "Orange puff-sleeve top + pink trousers", tags: ["summer", "casual", "date", "party"], src: "/demo/outfits/sum-0014.webp" },
  { id: "sum-0209", title: "White tee + cargo khakis", tags: ["summer", "casual", "streetwear", "outdoor", "travel"], src: "/demo/outfits/sum-0209.webp" },
  { id: "sum-0213", title: "Black blouse + grey trousers", tags: ["summer", "business", "work", "elegant"], src: "/demo/outfits/sum-0213.webp" },
  { id: "sum-0241", title: "Green shirt + white linen", tags: ["summer", "casual", "relaxed", "weekend"], src: "/demo/outfits/sum-0241.webp" },
  { id: "aut-0001", title: "Burgundy blouse + brown flares", tags: ["fall", "casual", "vintage", "weekend"], src: "/demo/outfits/aut-0001.webp" },
  { id: "aut-0010", title: "Beige coat + navy shorts", tags: ["fall", "elegant", "classic", "vintage", "date"], src: "/demo/outfits/aut-0010.webp" },
  { id: "aut-0039", title: "Long cardigan + ivory trousers", tags: ["fall", "cozy", "casual", "vintage", "classic"], src: "/demo/outfits/aut-0039.webp" },
  { id: "aut-0091", title: "Mustard cardigan + dark jeans", tags: ["fall", "date", "dinner", "elegant"], src: "/demo/outfits/aut-0091.webp" },
  { id: "aut-0169", title: "Field jacket + hoodie", tags: ["fall", "streetwear", "casual", "outdoor", "travel"], src: "/demo/outfits/aut-0169.webp" },
  { id: "aut-0217", title: "Grey cardigan + black trousers", tags: ["fall", "business", "office", "work", "classic"], src: "/demo/outfits/aut-0217.webp" },
  { id: "aut-0240", title: "Denim on denim", tags: ["fall", "streetwear", "casual", "vintage", "weekend"], src: "/demo/outfits/aut-0240.webp" },
  { id: "win-0037", title: "Black knit + tan trousers", tags: ["winter", "cozy", "casual"], src: "/demo/outfits/win-0037.webp" },
  { id: "win-0079", title: "Beige knit + ivory trousers", tags: ["winter", "cozy", "elegant", "relaxed", "luxury"], src: "/demo/outfits/win-0079.webp" },
  { id: "win-0104", title: "Green knit + long coat", tags: ["winter", "cozy", "elegant", "classic"], src: "/demo/outfits/win-0104.webp" },
  { id: "win-0163", title: "Black coat + dark denim", tags: ["winter", "elegant", "classic", "night-out"], src: "/demo/outfits/win-0163.webp" },
  { id: "win-0182", title: "Plaid shacket + hoodie + cargos", tags: ["winter", "streetwear", "casual", "travel"], src: "/demo/outfits/win-0182.webp" },
  { id: "win-0194", title: "Red plaid jacket + hoodie", tags: ["winter", "streetwear", "casual", "vintage"], src: "/demo/outfits/win-0194.webp" },
  { id: "win-0203", title: "Floral cardigan + jeans", tags: ["winter", "casual", "streetwear"], src: "/demo/outfits/win-0203.webp" },
  { id: "win-0240", title: "Black jacket + beige trousers", tags: ["winter", "business", "work", "elegant", "night-out"], src: "/demo/outfits/win-0240.webp" },
  { id: "win-0260", title: "Vest + hoodie", tags: ["winter", "streetwear", "casual", "outdoor"], src: "/demo/outfits/win-0260.webp" },
  { id: "pty-0013", title: "Chiffon midi", tags: ["party", "event", "wedding", "elegant", "formal", "date"], src: "/demo/outfits/pty-0013.webp" },
  { id: "pty-0016", title: "Red lace midi", tags: ["party", "event", "formal", "date", "night-out", "wedding"], src: "/demo/outfits/pty-0016.webp" },
  { id: "pty-0023", title: "Blue satin + fur", tags: ["party", "event", "elegant", "formal", "night-out", "luxury"], src: "/demo/outfits/pty-0023.webp" },
  { id: "pty-0031", title: "Black sequin mini", tags: ["party", "night-out", "event"], src: "/demo/outfits/pty-0031.webp" },
  { id: "pty-0043", title: "Navy lace midi", tags: ["party", "event", "formal", "elegant", "dinner", "wedding"], src: "/demo/outfits/pty-0043.webp" },
];

export const outfitById = (id: string | null | undefined) =>
  STYLE_OUTFITS.find((o) => o.id === id) || null;
