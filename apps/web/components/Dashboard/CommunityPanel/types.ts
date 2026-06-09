export interface CommunityLook {
  id: string;
  score: number;
  persona: string | null;
  headline: string;
  takeaways: string[];
  topics: string[];
  likes: number;
  createdAt: string;
  reactions: Record<string, number>;
}

export type SortMode = "trending" | "latest";
export type PanelView = "browse" | "reactions" | "saved" | "moderation";
export type LayoutMode = "list" | "grid";

export const PERSONAS = [
  "miranda",
  "edina",
  "shaft",
  "luxury",
  "streetwear",
  "sustainable",
] as const;

export const REACTION_EMOJIS = ["🔥", "👍", "😍", "💯", "✨"] as const;

export const LAST_SEEN_KEY = "onpoint-community-last-seen";
export const NEW_LOOK_CHECK_KEY = "onpoint-community-new-check";
export const BOOKMARKS_KEY = "onpoint-community-bookmarks";
export const REPORTED_KEY = "onpoint-community-reported";

export const ACCENT_COLORS: Record<string, string> = {
  miranda: "from-purple-500 to-pink-500",
  edina: "from-amber-500 to-rose-500",
  shaft: "from-sky-500 to-indigo-500",
  luxury: "from-emerald-500 to-teal-500",
  streetwear: "from-orange-500 to-red-500",
  sustainable: "from-lime-500 to-green-500",
};
export const DEFAULT_GRAD = "from-primary to-accent";
