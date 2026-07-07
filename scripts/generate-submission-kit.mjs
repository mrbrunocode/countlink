#!/usr/bin/env node
/**
 * Generates the copy + checklist used to submit the site to directories,
 * from one source of truth, so the pitch is consistent everywhere instead
 * of being retyped slightly differently 20 times.
 *
 * This does NOT submit anything itself — see docs/seo-outreach-plan.md for
 * why most directory submissions stay a deliberate, human, one-at-a-time
 * step (form quality checks, ToS, spam-flagging risk) rather than a script
 * filling in forms unattended. What this script automates is the annoying
 * part: having the right name/tagline/description/tags ready to paste,
 * every time, without re-writing them per site.
 *
 * Usage:
 *   node scripts/generate-submission-kit.mjs
 *   -> writes docs/submission-kit.json and docs/submission-checklist.md
 */
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

// ---- Update these once the name/domain are final, then re-run ----
const COPY = {
  name: "samesecond", // placeholder — update once the CountLink/OurCountdown decision is made
  url: "https://samesecond.example",
  tagline: "One countdown. Every screen. Exactly in sync.",
  one_liner: "A free shared countdown timer — set it once, share the link, everyone sees the same countdown in sync.",
  short_description:
    "samesecond is a free, zero-signup countdown timer for classrooms, exams, webinars, workshops and standups. " +
    "Set a duration, copy the link, and everyone who opens it sees the identical countdown — because the deadline " +
    "is a timestamp inside the link itself, not stored on a server.",
  long_description:
    "samesecond solves a specific, small problem well: getting a room (or a remote team, or a class taking an " +
    "exam) to agree on exactly how much time is left, without everyone starting their own timer slightly out of " +
    "sync. Set a duration or a target time, copy the generated link, and send it anywhere — Slack, email, a " +
    "projector screen, a webinar waiting room. Every device that opens the link counts down to the same instant, " +
    "computed from a timestamp embedded in the URL, so there's no account, no backend, and no drift between " +
    "devices. It includes a fullscreen \"projector\" mode and three display styles (a mechanical split-flap board, " +
    "a minimal flat-digit view, and a light theme for projecting in bright rooms). Free to use; a $5/mo Pro tier " +
    "removes ads and adds custom branding for people running it in front of clients.",
  category_tags: ["Productivity", "Education", "Web App", "Time Management", "Free Tools", "Utilities"],
  pricing: "Free — optional $5/mo Pro (removes ads, adds branding, for recurring facilitators)",
  contact_email: "you@example.com", // update to a real inbox before submitting anywhere
  repo_note: "Static site, no account system, no tracking beyond optional GA4/AdSense once configured (see docs/monetization.md).",
};

// ---- Directory targets. `tier` matches docs/seo-outreach-plan.md's tiers. ----
const DIRECTORIES = [
  // Tier 2: semi-automated — copy-paste form submission, no ToS risk, no CAPTCHA-bot needed
  { name: "AlternativeTo", url: "https://alternativeto.net/software/new/", method: "form", tier: 2,
    notes: "List as an alternative to vClock/online-stopwatch/Google Timer. Needs a screenshot." },
  { name: "SaaSHub", url: "https://www.saashub.com/submit", method: "form", tier: 2,
    notes: "Submit as a free tool; category Productivity/Education." },
  { name: "Slant", url: "https://www.slant.co/", method: "form", tier: 2,
    notes: "Best added as an answer/option on an existing relevant question (e.g. 'best online timers') rather than a blind submission." },
  { name: "StackShare", url: "https://stackshare.io/tools/new", method: "form", tier: 2,
    notes: "Developer-tool leaning audience; frame around the zero-backend/URL-state mechanic." },
  { name: "BetaList", url: "https://betalist.com/submit", method: "form", tier: 2,
    notes: "Aimed at pre-launch/early products — best used once, near actual launch, not after the fact." },
  { name: "SourceForge", url: "https://sourceforge.net/software/vendors/", method: "form", tier: 2,
    notes: "Business/web-app software directory; free vendor listing available." },
  { name: "Product Hunt", url: "https://www.producthunt.com/posts/new", method: "form+event", tier: 2,
    notes: "Prep copy/assets here, but the actual launch (day, timing, replying to comments) is Tier 3 — see plan doc." },
  { name: "GitHub awesome-lists (education)", url: "https://github.com/search?q=awesome+education&type=repositories", method: "pull-request", tier: 2,
    notes: "Opening the PR is scriptable (gh CLI); wording + the maintainer's merge decision are not. One PR per relevant list, not a mass campaign." },
  { name: "GitHub awesome-lists (free software / self-hosted-adjacent)", url: "https://github.com/search?q=awesome+free-software&type=repositories", method: "pull-request", tier: 2,
    notes: "Same as above — only lists where a free browser timer genuinely fits the theme." },

  // Tier 3: manual/social — deliberately not scripted, see plan doc for why
  { name: "Show HN (Hacker News)", url: "https://news.ycombinator.com/submit", method: "manual-social", tier: 3,
    notes: "One real post, real account, good title, be present to answer comments. Never automate HN submissions." },
  { name: "r/SideProject", url: "https://www.reddit.com/r/SideProject/", method: "manual-social", tier: 3,
    notes: "Reddit's own rules prohibit automated posting; do this by hand, once, with a genuine account." },
  { name: "r/InternetIsBeautiful", url: "https://www.reddit.com/r/InternetIsBeautiful/", method: "manual-social", tier: 3,
    notes: "Strict about self-promotion — read community rules before posting; may need someone else to post it." },
  { name: "r/Teachers / r/Professors", url: "https://www.reddit.com/r/Teachers/", method: "manual-social", tier: 3,
    notes: "Frame as a free classroom/exam tool, not a launch announcement — different norms than r/SideProject." },
  { name: "Teacher/workshop-tool blog roundups", url: "", method: "manual-outreach", tier: 3,
    notes: "Find existing 'best free online timers' posts and email the author asking to be added. Personalize each email — do not mail-merge at scale." },
];

const outJson = {
  generated_at: new Date().toISOString(),
  copy: COPY,
  directories: DIRECTORIES,
};

function checklistMd() {
  const byTier = (t) => DIRECTORIES.filter(d => d.tier === t);
  const row = (d) => `| [${d.name}](${d.url || "#"}) | ${d.method} | ${d.notes} | ☐ not started |`;
  return `# Submission checklist

Generated from \`scripts/generate-submission-kit.mjs\` — edit the data there, not this file
(it gets overwritten on the next run). Update the ☐ status manually as you go, or swap it for
☑ done / ✗ skipped.

## Copy to paste (source of truth: \`docs/submission-kit.json\`)

**Name:** ${COPY.name}
**Tagline:** ${COPY.tagline}
**One-liner:** ${COPY.one_liner}
**Short description:** ${COPY.short_description}
**Tags:** ${COPY.category_tags.join(", ")}
**Pricing:** ${COPY.pricing}

<details><summary>Long description (for sites that want more)</summary>

${COPY.long_description}

</details>

## Tier 2 — semi-automated (form/PR, no ToS risk, ~2 min each with the copy above)

| Site | Method | Notes | Status |
|---|---|---|---|
${byTier(2).map(row).join("\n")}

## Tier 3 — manual/social only (see docs/seo-outreach-plan.md for why these stay manual)

| Site | Method | Notes | Status |
|---|---|---|---|
${byTier(3).map(row).join("\n")}
`;
}

async function main() {
  await writeFile(join(ROOT, "docs", "submission-kit.json"), JSON.stringify(outJson, null, 2), "utf-8");
  await writeFile(join(ROOT, "docs", "submission-checklist.md"), checklistMd(), "utf-8");
  console.log("Wrote docs/submission-kit.json and docs/submission-checklist.md");
  console.log(`Directories listed: ${DIRECTORIES.length} (Tier 2: ${DIRECTORIES.filter(d=>d.tier===2).length}, Tier 3: ${DIRECTORIES.filter(d=>d.tier===3).length})`);
  console.log("\nReminder: update COPY.name/url/contact_email in this script once the domain/name are final, then re-run.");
}

main();
