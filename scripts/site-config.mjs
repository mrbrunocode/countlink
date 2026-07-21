/**
 * Single source of truth for the project's name and domain.
 *
 * This is the ONE file to edit when the brand changes — but don't hand-edit
 * it directly for a rename; run scripts/rename-brand.mjs instead, which
 * updates this file AND every hand-written file that references these
 * values (index.html, privacy.html, README.md, docs/*.md), then regenerates
 * everything that's built from it (timer pages, sitemap, submission kit).
 *
 * Every script in this project imports from here rather than hardcoding
 * the name/domain locally, so there is exactly one place that can drift.
 */
export const NAME = "CountLink";        // used in prose, titles, logo text
export const NAME_LOWER = "countlink";  // used in URLs, slugs, footer copyright-style mentions
export const TAGLINE = "One countdown. Every screen. Exactly in sync.";
export const SITE_URL = "https://countlink.app"; // update once the real domain is bought (see README domain shortlist)
export const CONTACT_EMAIL = "hello@countlink.app"; // update alongside SITE_URL — privacy.html and every footer reference this
export const LAST_UPDATED = "July 8, 2026"; // bump by hand whenever privacy.html's actual policy text changes — never auto-generate this from the current date
export const CONTENT_DATE = "2026-07-08"; // ISO date used for datePublished/dateModified JSON-LD across pages — bump when page copy actually changes
export const DESCRIPTION =
  "Set a countdown, share the link. Everyone who opens it sees the identical timer, perfectly in sync — " +
  "no account, no server, no app. Built for classrooms, exams, webinars, workshops and standups.";

// Affiliate recommendation card (empty until a real affiliate account
// exists). Only rendered on pages tagged `affiliate: true` in PAGES (see
// build-timer-pages.mjs) — the work/productivity-context timers, not the
// party/countdown ones, so the recommendation stays genuinely relevant
// instead of feeling bolted on.
export const AFFILIATE_NAME = "";
export const AFFILIATE_URL = "";
export const AFFILIATE_BLURB = "";
