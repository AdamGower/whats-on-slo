"use server";

import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { Resend } from "resend";

const TIMEZONE = "America/Los_Angeles";

// Convert a "2026-05-15T19:30" datetime-local input value (assumed Pacific)
// into a UTC ISO string for storage.
function pacificLocalToUtcIso(value: string): string | null {
  if (!value) return null;
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

function formatPacific(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: TIMEZONE,
    timeZoneName: "short",
  });
}

type SubmissionPayload = {
  title: string;
  starts_at: string;
  ends_at: string | null;
  venue: string;
  community: string;
  description: string;
  source_url: string | null;
  category: string;
  submitter_email: string | null;
  submitter_name: string | null;
};

// Send notification + (optional) confirmation. Email failures are logged but
// never block the submission flow — the row is already in the DB at this
// point and the moderator dashboard is the source of truth.
async function sendNotifications(submission: SubmissionPayload) {
  const apiKey = process.env.RESEND_API_KEY;
  const notifyTo = process.env.NOTIFY_EMAIL;
  if (!apiKey || !notifyTo) {
    console.warn("Email skipped — RESEND_API_KEY or NOTIFY_EMAIL not set.");
    return;
  }

  const resend = new Resend(apiKey);
  const fromAddress = "What's On SLO <hello@whatsonslo.com>";

  const lines = [
    `Title:        ${submission.title}`,
    `When:         ${formatPacific(submission.starts_at)}` +
      (submission.ends_at ? ` → ${formatPacific(submission.ends_at)}` : ""),
    `Venue:        ${submission.venue}`,
    `Community:    ${submission.community}`,
    `Category:     ${submission.category}`,
    submission.source_url ? `Link:         ${submission.source_url}` : null,
    submission.submitter_name || submission.submitter_email
      ? `Submitted by: ${[submission.submitter_name, submission.submitter_email]
          .filter(Boolean)
          .join(" — ")}`
      : null,
    "",
    "Description:",
    submission.description,
    "",
    "To moderate, open Supabase → submissions table → mark approved or rejected.",
  ]
    .filter(Boolean)
    .join("\n");

  // 1. Notification to the site owner
  try {
    await resend.emails.send({
      from: fromAddress,
      to: notifyTo,
      subject: `New event submission: ${submission.title}`,
      text: lines,
    });
  } catch (err) {
    console.error("Notification email failed:", err);
  }

  // 2. Confirmation to the submitter (only if they gave an email)
  if (submission.submitter_email) {
    try {
      await resend.emails.send({
        from: fromAddress,
        to: submission.submitter_email,
        subject: "We got your event submission — What's On SLO",
        text: [
          `Hi${submission.submitter_name ? " " + submission.submitter_name : ""},`,
          "",
          `Thanks for submitting "${submission.title}" to What's On SLO.`,
          "",
          "We review every submission before it goes live on the calendar.",
          "If it fits, you'll see it appear at https://whatsonslo.com within a day or two.",
          "",
          "— What's On SLO",
        ].join("\n"),
      });
    } catch (err) {
      console.error("Confirmation email failed:", err);
    }
  }
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
    redirect("/submit?ok=1");
  }

  const errors: string[] = [];
  if (!title) errors.push("Event name is required.");
  if (!venue) errors.push("Venue is required.");
  if (!community) errors.push("Community / city is required.");
  if (!description) errors.push("Description is required.");
  if (!startsAtRaw) errors.push("Start date and time are required.");
  if (!sourceUrl) errors.push("A link to the event page or tickets is required.");
  else if (!/^https?:\/\//i.test(sourceUrl)) {
    errors.push("Link must start with http:// or https://.");
  }
  if (!submitterName) errors.push("Your name is required.");
  if (!submitterEmail) errors.push("Your email is required.");
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submitterEmail)) {
    errors.push("That email doesn't look right.");
  }
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
    redirect(
      `/submit?err=${encodeURIComponent(
        "Couldn't read the start date — please check the format."
      )}`
    );
  }

  const sb = getServerClient();
  const payload: SubmissionPayload = {
    title,
    venue,
    community,
    description,
    source_url: sourceUrl || null,
    category,
    starts_at: startsAt!,
    ends_at: endsAt,
    submitter_email: submitterEmail || null,
    submitter_name: submitterName || null,
  };

  const { error } = await sb.from("submissions").insert(payload);

  if (error) {
    console.error("submission insert failed:", error);
    redirect(
      `/submit?err=${encodeURIComponent(
        "Sorry, something went wrong saving your submission. Try again in a moment?"
      )}`
    );
  }

  // Fire-and-(don't-wait): send notification emails. Awaited so logs surface
  // in the same request, but failures are swallowed inside.
  await sendNotifications(payload);

  redirect("/submit?ok=1");
}
