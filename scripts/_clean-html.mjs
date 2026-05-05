// Shared HTML-to-plain-text helper for scraper description fields.
//
// Many SLO venues sit on Squarespace, which inlines block CSS like
// `#block-yui_3_17_2_1_... { --sqs-block-content-flex: 0; }` into event
// markup via <style> tags. A naive `text.replace(/<[^>]*>/g, "")` strips
// the tags but keeps the CSS rule body as text, leaking custom-property
// declarations into our descriptions. Cheerio's `.text()` does the same:
// it extracts text from <style> descendants too.
//
// This helper:
//   1. Parses the input as an HTML fragment.
//   2. Removes <style> and <script> elements outright (text content gone).
//   3. Extracts text from the remainder (cheerio decodes HTML entities).
//   4. Belt-and-suspenders: scrubs residual CSS-rule shapes
//      (`#selector { ... }`) and stray CSS-variable declarations
//      (`--foo: bar;`) in case CSS arrives as bare text rather than
//      inside a <style> tag.
//   5. Collapses whitespace.

import * as cheerio from "cheerio";

export function cleanDescriptionHtml(html) {
  if (!html) return "";
  const $ = cheerio.load(`<div id="root">${html}</div>`);
  $("#root style, #root script").remove();
  let text = $("#root").first().text();
  text = text.replace(/#[a-zA-Z0-9_-]+\s*\{[^}]*\}/g, " ");
  text = text.replace(/--[a-zA-Z][a-zA-Z0-9-]*\s*:[^;}\n]*[;}]?/g, " ");
  return text.replace(/\s+/g, " ").trim();
}
