// Shared HTML-to-plain-text helpers for scraper text fields.
//
// Many SLO venues sit on Squarespace, which inlines block CSS like
// `#block-yui_3_17_2_1_... { --sqs-block-content-flex: 0; }` into event
// markup via <style> tags. A naive `text.replace(/<[^>]*>/g, "")` strips
// the tags but keeps the CSS rule body as text, leaking custom-property
// declarations into our descriptions. Cheerio's `.text()` does the same:
// it extracts text from <style> descendants too.
//
// Entity decoding is handled by the `entities` package rather than a
// hand-rolled replace chain. The chain this replaced covered `&amp;` but not
// its numeric twin `&#038;`, nor `&#8211;`, `&mdash;`, `&bull;`, or any of the
// accented forms (`&oacute;`, `&ntilde;`) that show up in bilingual listings —
// so those leaked to the site as literal text. A real decoder resolves named,
// numeric, and hex entities alike, and needs no maintenance as feeds change.

import * as cheerio from "cheerio";
import { decodeHTML } from "entities";

// Decode a plain-text field (title, venue). Feeds hand us these already
// tag-free but frequently entity-encoded ("Buffalo Pub &#038; Grill"), and
// they never pass through cheerio, so nothing was decoding them at all.
export function cleanText(value) {
  if (!value) return "";
  return decodeHTML(String(value)).replace(/\s+/g, " ").trim();
}

// Same decode, but keeps paragraph breaks. Some feeds (BigBigSLO, Sea Pines,
// rideshare) deliver tag-free descriptions with meaningful "\n\n" paragraphs;
// running those through cleanDescriptionHtml would flatten them into one
// blob, so they get the entity pass without the whitespace collapse.
export function cleanTextPreservingBreaks(value) {
  if (!value) return "";
  return decodeHTML(String(value))
    .replace(/[^\S\n]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Full HTML -> text for description fields:
//   1. Parses the input as an HTML fragment.
//   2. Removes <style> and <script> elements outright (text content gone).
//   3. Extracts text from the remainder.
//   4. Belt-and-suspenders: scrubs residual CSS-rule shapes
//      (`#selector { ... }`) and stray CSS-variable declarations
//      (`--foo: bar;`) in case CSS arrives as bare text rather than
//      inside a <style> tag.
//   5. Decodes entities AFTER tag stripping. Cheerio's .text() already
//      decodes once; this second pass is what recovers double-encoded input
//      (`&amp;ndash;` -> cheerio -> `&ndash;` -> here -> `–`), which is how a
//      handful of Visit SLO and goslo rows arrive. Decoding is idempotent on
//      real-world input, so the extra pass cannot progressively mangle text.
//   6. Collapses whitespace.
export function cleanDescriptionHtml(html) {
  if (!html) return "";
  const $ = cheerio.load(`<div id="root">${html}</div>`);
  $("#root style, #root script").remove();
  let text = $("#root").first().text();
  text = text.replace(/#[a-zA-Z0-9_-]+\s*\{[^}]*\}/g, " ");
  text = text.replace(/--[a-zA-Z][a-zA-Z0-9-]*\s*:[^;}\n]*[;}]?/g, " ");
  text = decodeHTML(text);
  return text.replace(/\s+/g, " ").trim();
}
