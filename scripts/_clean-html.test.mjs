// Tests for _clean-html.mjs.
// Run with: `node --test scripts/_clean-html.test.mjs`

import { test } from "node:test";
import assert from "node:assert/strict";

import { cleanDescriptionHtml } from "./_clean-html.mjs";

test("cleanDescriptionHtml strips plain HTML tags", () => {
  const html = "<p>Live music at <b>The Siren</b> tonight.</p>";
  assert.equal(
    cleanDescriptionHtml(html),
    "Live music at The Siren tonight."
  );
});

test("cleanDescriptionHtml drops <style> block contents (the bug)", () => {
  // Real-world shape: Squarespace inlines block CSS into event details.
  // .text() would extract the CSS rule body as text. After fix, it should
  // disappear entirely.
  const html = `
    Buy tickets now
    <style>
      #block-yui_3_17_2_1_1773177398998_56681 { --sqs-block-content-flex: 0; }
      #block-yui_3_17_2_1_1773177398998_56681 { --opacity: 100%; --translate-x: 0px; }
    </style>
    More info on the venue page.
  `;
  const out = cleanDescriptionHtml(html);
  assert.equal(out, "Buy tickets now More info on the venue page.");
  assert.doesNotMatch(out, /sqs-/);
  assert.doesNotMatch(out, /--/);
  assert.doesNotMatch(out, /\{/);
});

test("cleanDescriptionHtml drops <script> block contents", () => {
  const html = "Show starts at 8 <script>alert(1)</script>tonight";
  const out = cleanDescriptionHtml(html);
  assert.equal(out, "Show starts at 8 tonight");
  assert.doesNotMatch(out, /alert/);
});

test("cleanDescriptionHtml scrubs residual CSS-rule shapes if they leak in as text", () => {
  // Belt-and-suspenders: even if the upstream HTML structure is unusual
  // and the CSS arrives as bare text rather than inside <style>, we strip it.
  const html =
    "Free skate event #block-foo123 { --sqs-block-content-flex: 0; } family-friendly";
  const out = cleanDescriptionHtml(html);
  assert.match(out, /Free skate event/);
  assert.match(out, /family-friendly/);
  assert.doesNotMatch(out, /sqs-/);
  assert.doesNotMatch(out, /\{/);
  assert.doesNotMatch(out, /#block-foo123/);
});

test("cleanDescriptionHtml scrubs stray CSS variable declarations", () => {
  const html = "Doors 7pm --opacity: 50%; show 8pm";
  const out = cleanDescriptionHtml(html);
  assert.match(out, /Doors 7pm/);
  assert.match(out, /show 8pm/);
  assert.doesNotMatch(out, /--opacity/);
});

test("cleanDescriptionHtml passes plain text through unchanged (modulo whitespace)", () => {
  const html = "  Concert at  Vina   Robles. Tickets $30.  ";
  assert.equal(
    cleanDescriptionHtml(html),
    "Concert at Vina Robles. Tickets $30."
  );
});

test("cleanDescriptionHtml returns empty string for empty/null input", () => {
  assert.equal(cleanDescriptionHtml(""), "");
  assert.equal(cleanDescriptionHtml(null), "");
  assert.equal(cleanDescriptionHtml(undefined), "");
});

test("cleanDescriptionHtml decodes HTML entities", () => {
  // Cheerio's .text() decodes entities natively — useful for sources
  // (library, visit-slo) whose feeds emit HTML-encoded apostrophes/quotes.
  assert.equal(cleanDescriptionHtml("Bob &amp; Alice"), "Bob & Alice");
  assert.equal(cleanDescriptionHtml("It&#39;s tonight"), "It's tonight");
  assert.equal(cleanDescriptionHtml("&ldquo;hi&rdquo;"), "“hi”");
  assert.equal(cleanDescriptionHtml("Caf&eacute;"), "Café");
});

test("cleanDescriptionHtml exact regression case from production (goslo)", () => {
  // The actual offending row (gs-star-wars-public-fun-skate-2026-05-02):
  // descriptions in that family had a long CSS rule appended after the body text.
  const html =
    "In celebration of May the 4th, CCRD will be hosting a fun skate. " +
    "Buy tickets now <style>#block-yui_3_17_2_1_1773177398998_56681 " +
    "{--sqs-block-content-flex: 0; } " +
    "#block-yui_3_17_2_1_1773177398998_56681 " +
    "{ --opacity: 100%; --translate-x: 0px; --translate-y: 0px; --rotation: 0deg; " +
    "--scale-x: 100%; --scale-y: 100%; --skew-x: 0deg; --skew-y: 0deg; " +
    "--origin-x: 50%; --origin-y: 50%; opacity: var(--opacity, 1); " +
    "transform: translateX(var(--translate-x)) translateY(var(--translate-y)) " +
    "rotate(var(--rotation)) scale(var(--scale-x), var(--scale-y)) " +
    "skewX(var(--skew-x)) skewY(var(--skew-y)); " +
    "transform-origin: var(--origin-x) var(--origin-y); }</style>";
  const out = cleanDescriptionHtml(html);
  assert.equal(
    out,
    "In celebration of May the 4th, CCRD will be hosting a fun skate. Buy tickets now"
  );
});
