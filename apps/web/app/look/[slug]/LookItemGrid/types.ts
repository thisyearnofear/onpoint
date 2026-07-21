export interface LookItem {
  id: string;
  title: string;
  curatorSlug: string;
  imageUrl: string | null;
  isHero: boolean;
  sizes: Array<{ size: string; stock: number; price: number }>;
  tags: string[];
  kit: { club: string; kitType: string; brand: string } | null;
}

export interface SimilarItem {
  listingId: string;
  curatorSlug: string;
  curatorName: string;
  title: string;
  imageUrl: string | null;
  cutoutUrl: string | null;
  lowestPrice: number | null;
  sizes: Array<{ size: string; stock: number; price: number }>;
  storefrontUrl: string;
}

export interface LookItemGridProps {
  items: LookItem[];
  referralCode: string;
  lookSlug: string;
  curatorSlug: string | null;
}
