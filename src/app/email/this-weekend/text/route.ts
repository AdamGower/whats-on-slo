import { fetchWeekendEvents } from "@/lib/weekend";
import { renderWeekendEmailText } from "@/lib/weekend-email";

// Plain-text version of the weekend email, for the text part of a send.
export const revalidate = 900;

export async function GET() {
  const { window, events } = await fetchWeekendEvents();
  return new Response(renderWeekendEmailText(window, events), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Robots-Tag": "noindex",
    },
  });
}
