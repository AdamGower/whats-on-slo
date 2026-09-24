// Shared fetch wrapper that retries transient failures. Two scheduled runs on
// 2026-09-23 died on a 10s connect timeout to app.ticketmaster.com and the
// next run was fine; every source can hit the same kind of blip.
//
// Retries only network errors, 429 and 5xx: up to 3 attempts, waiting 5s then
// 15s. Any other status (304, 401, 404, ...) comes back on the first attempt
// so caller logic and loud failures stay as they were. After the last attempt
// the final response (or network error) is handed to the caller unchanged, so
// each scraper's own `!res.ok` handling still decides what a failure means.

export const RETRY_DELAYS_MS = [5_000, 15_000]; // 3 attempts total

export async function fetchWithRetry(url, init, { delaysMs = RETRY_DELAYS_MS } = {}) {
  for (let attempt = 1; ; attempt++) {
    const last = attempt >= delaysMs.length + 1;
    let res;
    try {
      res = await fetch(url, init);
    } catch (err) {
      if (last) throw err;
      await backoff(delaysMs, attempt, url, `network error (${err.cause?.code || err.message})`);
      continue;
    }
    const transient = res.status === 429 || res.status >= 500;
    if (!transient || last) return res;
    // Drain the body we're discarding so the connection can be reused.
    await res.body?.cancel();
    await backoff(delaysMs, attempt, url, `HTTP ${res.status}`);
  }
}

async function backoff(delaysMs, attempt, url, reason) {
  const ms = delaysMs[attempt - 1];
  // Log host + path only: some URLs carry an API key in the query string.
  const u = new URL(url);
  console.warn(
    `  Attempt ${attempt} for ${u.host}${u.pathname} failed: ${reason}. Retrying in ${ms / 1000}s...`
  );
  await new Promise((r) => setTimeout(r, ms));
}
