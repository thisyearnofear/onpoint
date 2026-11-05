export interface FilterOption {
  value: string;
  label: string;
}

export const VIBES: FilterOption[] = [
  { value: "", label: "All" },
  { value: "streetwear", label: "Streetwear" },
  { value: "casual", label: "Casual" },
  { value: "formal", label: "Formal" },
  { value: "event", label: "Event" },
  { value: "sport", label: "Sport" },
  { value: "vintage", label: "Vintage" },
  { value: "ankara", label: "Ankara" },
  { value: "sustainable", label: "Sustainable" },
];

export const OCCASIONS: FilterOption[] = [
  { value: "", label: "Any occasion" },
  { value: "casual", label: "Casual" },
  { value: "formal", label: "Formal" },
  { value: "event", label: "Event" },
  { value: "sport", label: "Sport" },
  { value: "outdoor", label: "Outdoor" },
  { value: "travel", label: "Travel" },
  { value: "date-night", label: "Date night" },
];

export const SEASONS: FilterOption[] = [
  { value: "", label: "Any season" },
  { value: "spring", label: "Spring" },
  { value: "summer", label: "Summer" },
  { value: "fall", label: "Fall" },
  { value: "winter", label: "Winter" },
];

export const SORT_OPTIONS = [
  { value: "trending", label: "Trending", icon: "TrendingUp" },
  { value: "newest", label: "Newest", icon: "Clock" },
] as const;
