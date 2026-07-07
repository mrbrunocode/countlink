#!/usr/bin/env node
/**
 * Renames the project across the whole repo in one command.
 *
 * scripts/site-config.mjs is the single source of truth for the name and
 * domain, but a handful of files are hand-written prose (index.html,
 * privacy.html, README.md, docs/*.md, robots.txt) that reference those
 * values in plain text rather than importing the config — a plain string
 * replace is the only way to update those. Everything else (timers/*.html,
 * sitemap.xml, docs/submission-kit.json, docs/submission-checklist.md) is
 * generated output and gets rebuilt fresh at the end, never hand-edited.
 *
 * Usage:
 *   node scripts/rename-brand.mjs "NewName" newname.example
 *
 * newname.example can be a real domain (e.g. countlink.io) once it's
 * bought, or another .example placeholder if you're just trying a name on
 * before buying anything.
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { NAME as OLD_NAME, SITE_URL as OLD_SITE_URL } from "./site-config.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const [, , newNameArg, newDomainArg] = process.argv;
if (!newNameArg) {
  console.error("Usage: node scripts/rename-brand.mjs \"NewName\" newdomain.example");
  console.error(`Current name: ${OLD_NAME}  (${OLD_SITE_URL})`);
  process.exit(1);
}

const NEW_NAME = newNameArg;
const NEW_NAME_LOWER = NEW_NAME.toLowerCase();
const OLD_NAME_LOWER = OLD_NAME.toLowerCase();
const OLD_HOST = new URL(OLD_SITE_URL).host;
const NEW_HOST = newDomainArg || `${NEW_NAME_LOWER}.example`;
const NEW_SITE_URL = `https://${NEW_HOST}`;

// Hand-written files only — never the generated ones (see header comment).
// If you add another hand-written page with its own canonical/OG/JSON-LD
// (like compare.html was, before it got missed on the first real rename),
// add it here too — this list is the only thing standing between a rename
// and stale URLs surviving in whichever file isn't on it.
const FILES = [
  "index.html", "privacy.html", "compare.html", "robots.txt", "README.md",
  "docs/monetization.md", "docs/seo-outreach-plan.md",
  "scripts/submit-indexnow.mjs", // only appears in a comment there, harmless to include
];

function replaceAll(text) {
  // Longest/most specific strings first so e.g. the full domain doesn't get
  // partially clobbered by a shorter name replacement running first.
  return text
    .split(OLD_HOST).join(NEW_HOST)
    .split(OLD_NAME_LOWER).join(NEW_NAME_LOWER)
    .split(OLD_NAME).join(NEW_NAME);
}

async function main() {
  if (OLD_NAME_LOWER === NEW_NAME_LOWER && OLD_HOST === NEW_HOST) {
    console.log("New name/domain are identical to the current ones — nothing to do.");
    return;
  }

  let changedFiles = 0;
  for (const rel of FILES) {
    const path = join(ROOT, rel);
    let text;
    try { text = await readFile(path, "utf-8"); }
    catch { continue; } // file doesn't exist, skip quietly
    const updated = replaceAll(text);
    if (updated !== text) {
      await writeFile(path, updated, "utf-8");
      changedFiles++;
      console.log(`Updated ${rel}`);
    }
  }

  const configPath = join(ROOT, "scripts", "site-config.mjs");
  let config = await readFile(configPath, "utf-8");
  // Blanket host swap first — catches CONTACT_EMAIL ("hello@old.example") and
  // anything else in the file that embeds the domain, not just SITE_URL's own
  // line. The targeted regex replacements below then handle NAME/NAME_LOWER
  // (which the blanket swap can't, since those aren't host strings).
  config = config.split(OLD_HOST).join(NEW_HOST);
  config = config
    .replace(/export const NAME = ".*?";/, `export const NAME = "${NEW_NAME}";`)
    .replace(/export const NAME_LOWER = ".*?";/, `export const NAME_LOWER = "${NEW_NAME_LOWER}";`)
    .replace(/export const SITE_URL = ".*?";.*/, `export const SITE_URL = "${NEW_SITE_URL}"; // update once the real domain is bought (see README domain shortlist)`);
  await writeFile(configPath, config, "utf-8");
  console.log(`Updated scripts/site-config.mjs (NAME="${NEW_NAME}", SITE_URL="${NEW_SITE_URL}")`);

  console.log(`\n${changedFiles} hand-written file(s) updated. Regenerating everything built from config...`);
  execFileSync("node", ["scripts/build-timer-pages.mjs"], { cwd: ROOT, stdio: "inherit" });
  execFileSync("node", ["scripts/generate-submission-kit.mjs"], { cwd: ROOT, stdio: "inherit" });

  console.log(`\nDone. Renamed ${OLD_NAME} -> ${NEW_NAME}, ${OLD_HOST} -> ${NEW_HOST}.`);
  console.log("Review the diff (git diff) before committing — this is a broad text replace, not a semantic one.");
}

main();
