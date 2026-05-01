"use server";

import { redirect } from "next/navigation";
import { Resend } from "resend";

export async function submitComment(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const message = String(formData.get("message") || "").trim();
  // Honeypot — see /submit/actions.ts
  const honeypot = String(formData.get("website") || "").trim();

  if (honeypot) {
    redirect("/comments?ok=1");
  }

  const errors: string[] = [];
  if (!name) errors.push("Your name is required.");
  if (!email) errors.push("Your email is required.");
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("That email doesn't look right.");
  }
  if (!message) errors.push("A message is required.");

  if (errors.length) {
    redirect(
      `/comments?err=${encodeURIComponent(errors.join(" "))}`
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  const notifyTo = process.env.NOTIFY_EMAIL;
  if (!apiKey || !notifyTo) {
    console.error(
      "Comment email skipped — RESEND_API_KEY or NOTIFY_EMAIL missing."
    );
    redirect(
      `/comments?err=${encodeURIComponent(
        "Email isn't configured on the server. Try again later."
      )}`
    );
  }

  const resend = new Resend(apiKey);
  const fromAddress = "What's On SLO <onboarding@resend.dev>";

  try {
    await resend.emails.send({
      from: fromAddress,
      to: notifyTo!,
      replyTo: email,
      subject: `Comment from ${name}`,
      text: [
        `Name:    ${name}`,
        `Email:   ${email}`,
        "",
        "Message:",
        message,
      ].join("\n"),
    });
  } catch (err) {
    console.error("Comment email failed:", err);
    redirect(
      `/comments?err=${encodeURIComponent(
        "Sorry, something went wrong sending your comment. Try again in a moment?"
      )}`
    );
  }

  redirect("/comments?ok=1");
}
