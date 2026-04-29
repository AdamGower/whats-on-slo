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
};
