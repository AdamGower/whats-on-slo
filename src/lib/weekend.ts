import { fetchEventsBetweenDays } from "@/lib/supabase";
import type { Event } from "@/types";
import { weekendWindow } from "@/lib/weekend-window";

export { weekendLabel, weekendWindow } from "@/lib/weekend-window";

export async function fetchWeekendEvents(now = new Date()): Promise<{
  window: ReturnType<typeof weekendWindow>;
  events: Event[];
}> {
  const window = weekendWindow(now);
  const events = await fetchEventsBetweenDays(window.from, window.to);
  return { window, events };
}
