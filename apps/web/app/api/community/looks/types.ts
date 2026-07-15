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
