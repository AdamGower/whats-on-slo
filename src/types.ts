export type Event = {
  id: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  venue: string;
  community: string;
  description: string;
  source: string;
  sourceUrl: string;
  category: "Music" | "Food & Drink" | "Arts" | "Community" | "Family" | "Outdoors";
  imageUrl?: string;
  // True when starts_at carries only a sentinel hour (the feed gave no clock
  // time and enrichment found none): the date is real, the time is not, so the
  // UI shows "Time TBA" instead of the placeholder hour.
  timeTba?: boolean;
};

export type Difficulty = "Easy" | "Moderate" | "Hard" | "Strenuous";

export type Trail = {
  name: string;
  area: string;
  trailhead: string;
  lat: number;
  lng: number;
  distance_miles: number;
  elevation_gain_ft: number;
  difficulty: Difficulty;
  trail_type: string;
  best_months: string;
  features: string;
  dogs: boolean;
  bikes: boolean;
  parking: string;
  hazards: string;
  tags: string[];
  hikers_say: string;
  source_url: string | null;
};
