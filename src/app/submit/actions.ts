"use server";

import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

const TIMEZONE = "America/Los_Angeles";

// Convert a "2026-05-15T19:30" datetime-local input value (assumed Pacific)
// into a UTC ISO string for storage.
function pacificLocalToUtcIso(value: string): string | null {
  if (!value) return null;
  // value: "YYYY-MM-DDTHH:MM" — treat as Pacific wall-clock
  const naive = `${value}:00Z`;
  const utcGuess = new Date(naive);
  if (isNaN(utcGuess.getTime())) return null;
  const laString = utcGuess.toLocaleString("sv-SE", { timeZone: TIMEZONE });
  const la = new Date(laString.replace(" ", "T") + "Z");
  const offsetMs = utcGuess.getTime() - la.getTime();
  return new Date(utcGuess.getTime() + offsetMs).toISOString();
}

const VALID_CATEGORIES = [
  "Music",
  "Food & Drink",
  "Arts",
  "Community",
  "Family",
  "Outdoors",
] as const;

function getServerClient() {
  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "Server misconfigured: SUPABASE_URL or SUPABASE_SECRET_KEY missing"
    );
  }
  return createClient(url, key);
}

export async function submitEvent(formData: FormData) {
  const title = String(formData.get("title") || "").trim();
  const venue = String(formData.get("venue") || "").trim();
  const community = String(formData.get("community") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const sourceUrl = String(formData.get("source_url") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const startsAtRaw = String(formData.get("starts_at") || "").trim();
  const endsAtRaw = String(formData.get("ends_at") || "").trim();
  const submitterEmail = String(formData.get("submitter_email") || "").trim();
  const submitterName = String(formData.get("submitter_name") || "").trim();
  // Honeypot — bots happily fill this; humans never see it
  const honeypot = String(formData.get("website") || "").trim();

  if (honeypot) {
    // Pretend success so bots don't probe
    redirect("/submit?ok=1");
  }

  // Validation
  const errors: string[] = [];
  if (!title) errors.push("Event name is required.");
  if (!venue) errors.push("Venue is required.");
  if (!community) errors.push("Community / city is required.");
  if (!description) errors.push("Description is required.");
  if (!startsAtRaw) errors.push("Start date and time are required.");
  if (!(VALID_CATEGORIES as readonly string[]).includes(category)) {
    errors.push("Pick a valid category.");
  }

  if (errors.length) {
    const params = new URLSearchParams({ err: errors.join(" ") });
    redirect(`/submit?${params}`);
  }

  const startsAt = pacificLocalToUtcIso(startsAtRaw);
  const endsAt = endsAtRaw ? pacificLocalToUtcIso(endsAtRaw) : null;
  if (!startsAt) {
    redirect(`/submit?err=${encodeURIComponent("Couldn't read the start date — please check the format.")}`);
  }

  const sb = getServerClient();
  const { error } = await sb.from("submissions").insert({
    title,
    venue,
    community,
    description,
    source_url: sourceUrl || null,
    category,
    starts_at: startsAt,
    ends_at: endsAt,
    submitter_email: submitterEmail || null,
    submitter_name: submitterName || null,
  });

  if (error) {
    console.error("submission insert failed:", error);
    redirect(
      `/submit?err=${encodeURIComponent("Sorry, something went wrong saving your submission. Try again in a moment?")}`
    );
  }

  redirect("/submit?ok=1");
}
