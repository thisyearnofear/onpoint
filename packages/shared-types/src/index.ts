// Shared types for the OnPoint application

export interface Item {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Outfit {
  id: string;
  name: string;
  items: Item[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Critique {
  id: string;
  outfitId: string;
  feedback: string;
  rating: number;
  createdAt: Date;
}