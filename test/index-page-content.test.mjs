// index.html has every FAQ answer written twice — once as visible <dd> copy,
// once inside the FAQPage JSON-LD schema, so Google's rich-result snippet
// says the same thing a reader sees. Nothing enforces they stay in sync
// except discipline; this test is the enforcement, added after the phone
// control feature required editing both copies of the same answer by hand.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(join(ROOT, "index.html"), "utf8");

function jsonLdFaqAnswers(source) {
  const m = source.match(/"@type":\s*"FAQPage"[\s\S]*?"mainEntity":\s*(\[[\s\S]*?\])\s*\}\s*<\/script>/);
  assert.ok(m, "FAQPage JSON-LD block not found in index.html");
  const parsed = JSON.parse(m[1]);
  return new Map(parsed.map((q) => [q.name, q.acceptedAnswer.text]));
}

function visibleFaqAnswers(source) {
  const grid = source.match(/<dl class="faq-grid">([\s\S]*?)<\/dl>/);
  assert.ok(grid, "visible FAQ grid not found in index.html");
  const items = [...grid[1].matchAll(/<h3>(.*?)<\/h3>\s*<dd>(.*?)<\/dd>/gs)];
  assert.ok(items.length > 0, "no <h3>/<dd> FAQ pairs found");
  return new Map(items.map(([, q, a]) => [q.trim(), a.trim()]));
}

test("every visible FAQ question has a matching JSON-LD entry", () => {
  const jsonLd = jsonLdFaqAnswers(html);
  const visible = visibleFaqAnswers(html);
  for (const question of visible.keys()) {
    assert.ok(jsonLd.has(question), `"${question}" is in the visible FAQ but missing from JSON-LD`);
  }
});

test("JSON-LD FAQ answers match the visible <dd> text exactly (plain-text comparison, tags stripped)", () => {
  const jsonLd = jsonLdFaqAnswers(html);
  const visible = visibleFaqAnswers(html);
  const stripTags = (s) => s.replace(/<[^>]+>/g, "").trim();
  for (const [question, visibleAnswer] of visible) {
    const ldAnswer = jsonLd.get(question);
    assert.equal(stripTags(visibleAnswer), stripTags(ldAnswer),
      `answer text differs between visible FAQ and JSON-LD for "${question}"`);
  }
});

test("the pause/adjust/stop FAQ answer mentions phone control as the live exception", () => {
  const visible = visibleFaqAnswers(html);
  const answer = visible.get("Can I pause or extend a countdown that's already running?");
  assert.ok(answer, "expected FAQ question not found");
  assert.match(answer, /phone control/i);
});
