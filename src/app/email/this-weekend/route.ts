import { fetchWeekendEvents } from "@/lib/weekend";
import { renderWeekendEmailHtml } from "@/lib/weekend-email";

// The "This weekend in SLO" email as ready-to-send HTML. Open it in a browser
// to preview, or copy the source into a Kit broadcast. Rebuilt in the
// background at most every 15 minutes so it always shows the current weekend.
export const revalidate = 900;

export async function GET() {
  const { window, events } = await fetchWeekendEvents();
  return new Response(renderWeekendEmailHtml(window, events), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex",
    },
  });
}
