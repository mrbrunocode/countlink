# Countlink Design System

**Countlink** is a synced timer/counter product: you create a countdown (or count-up), share a link, and everyone who opens that link sees the exact same number, ticking in perfect sync. This design system exists to give every "boring app" you build afterward — small, single-purpose consumer utilities — a consistent, professional visual language, without redesigning from zero each time.

No existing brand assets, codebase, or Figma file were attached for this project — everything here (tokens, components, wordmark, UI kit) was designed from scratch based on the product description and your answers to the intake questions (general consumers, single-page HTML apps, "top 10 quality boring app" bar, decide-for-me on vibe/type/density/dark-mode).

## Sources
None attached. If you have an existing Countlink codebase, Figma file, or brand guide, attach it and this system should be revised to match — right now it is an original design, not a recreation of anything.

## Who this is for
You build many small, focused consumer web utilities ("boring apps" that solve one small problem well) as single-page HTML. This system is meant to be the shared foundation across all of them: same tokens, same primitives, same tone — so each new app feels like part of one confident, understated product family rather than a one-off experiment.

---

## Index
- `styles.css` — root stylesheet, import this one file. Pulls in all tokens below.
- `tokens/colors.css` — neutral scale, accent, semantic colors (dark-first, light override via `[data-theme="light"]`)
- `tokens/typography.css` — Inter (UI) + JetBrains Mono (timer display), full type scale
- `tokens/spacing.css` — 4px-based spacing scale, radii, control heights
- `tokens/effects.css` — shadows, easing curves, durations, live-pulse keyframes
- `components/forms/` — Button, IconButton, Input, Select, Checkbox, Switch
- `components/feedback/` — Badge, Tag, Tooltip, Dialog, Toast
- `components/data-display/` — Card
- `components/product/` — **TimerDisplay**, **SyncBadge**, **ShareLink** — Countlink's signature primitives (intentional additions, see below)
- `guidelines/` — foundation specimen cards (colors, type, spacing, radii, brand, iconography, motion)
- `ui_kits/countlink/index.html` — click-through recreation of the core Countlink flow: dashboard → create → synced timer view
- `SKILL.md` — portable skill file for reuse in Claude Code

### Intentional additions
No source defined a component inventory, so a standard set (Button, Input, Select, Checkbox, Switch, Badge, Tag, Tooltip, Dialog, Toast, Card) was authored to typical consumer-app needs. Three components go beyond that standard set because they're core to what makes Countlink *Countlink*, not a generic app:
- **TimerDisplay** — the large synced number itself. Every "boring app" that counts or times something should reuse this rather than hand-rolling numerals.
- **SyncBadge** — the "N people are watching this right now, live" indicator — the proof that sync is actually happening.
- **ShareLink** — the copyable URL control, since sharing a link *is* the product's core mechanic.

---

## Content fundamentals
- **Voice**: plain, confident, low-key. No hype, no exclamation points, no emoji. Countlink is an instrument, not entertainment — copy gets out of the way of the number.
- **Person**: second person ("Anyone with the link can view"), never "the user."
- **Casing**: sentence case everywhere — headings, buttons, labels, tags. Never title case, never all-caps except tiny structural labels (e.g. a 10px "UNTIL LAUNCH" caption under a timer, which is a typographic device, not a tone choice).
- **Verbs over nouns** in buttons: "Create & get link," "End for everyone," "Copy link" — never "Submit" or "OK."
- **Honesty about consequences**: destructive actions say exactly what happens — "Everyone watching will see it stop immediately" — never a vague "Are you sure?"
- **No filler**: no onboarding tours, no marketing banners inside the product, no "Pro tip!" callouts. If a screen feels empty, that's fine — it's a utility, not a dashboard to justify.
- **Numbers are sacred**: never approximate, round for style, or animate the countdown number in a way that could look inaccurate. Precision is the entire value proposition.

## Visual foundations
- **Palette**: cool neutral gray (subtle blue undertone, not pure gray) as the base — dark-first. One confident brand accent, "link-blue" (`--accent`, oklch hue ≈265), used for every primary action, active/synced state, and focus ring. Three semantic accents (success green, warning amber, danger red) share the exact same lightness and chroma as the primary accent, only the hue rotates — so the palette always reads as one family, never like different UI kits stitched together.
- **Type**: Inter for all UI text (labels, buttons, body, headings) — a clean, humanist grotesk that stays legible at small sizes. JetBrains Mono, with tabular figures, is reserved *exclusively* for the synced number itself (`TimerDisplay`) — a technical, monospaced face signals "this is measured, not decorative," and tabular figures stop digits from jittering in width as they tick.
- **Density**: moderate-airy. Consumer-facing, not an admin panel — generous padding (16–24px) in cards and forms, but controls stay compact (40px default height) so the product feels precise rather than loose.
- **Dark mode**: dark-first, fully supported both ways via `[data-theme]` on `<body>` or any wrapper. Dark suits the product's real contexts (a countdown left open during a presentation, a launch-night party, a bedside display) and is the default; light is a complete equal citizen, not an afterthought.
- **Backgrounds**: flat color only. No gradients, no photography, no textures, no patterns. The one moment of motion-as-texture is the small pulsing "live" dot — everything else is still, so that stillness reads as calm precision rather than staleness.
- **Shadows**: soft and low-contrast, never a hard drop shadow. Four steps (`--shadow-xs` → `--shadow-lg`) for subtle depth on cards, dropdowns, dialogs.
- **Corners**: 6/10/16/24px scale (`--radius-sm/md/lg/xl`) plus a full-pill radius for badges and the theme switch. Cards use `lg` (16px) — soft but not toy-like.
- **Cards**: 1px hairline border (`--border-subtle`) + very light shadow + `lg` radius. No colored left-border accent, no rounded-corner-plus-icon-chip cliché.
- **Motion**: quick and physical, never bouncy — `--ease-standard` / `--ease-out`, 120–360ms. Buttons scale to 0.97 on press (a small, immediate physical response). Dialogs and toasts fade + rise 4px in. The one recurring animated motif is `cl-pulse-live` — a slow, gentle opacity pulse used *only* on genuinely live/real-time indicators (the live dot, a pulsing success badge) — never decoratively.
- **Hover/press states**: hover darkens/lightens background one step (`--surface-hover`, `--n-3`/`--n-4`); press scales the element down slightly. No color-shift-only hovers on already-colored primary buttons — depth (shadow/scale) carries the feedback instead.
- **Borders**: hairline (1px), always `--border` or `--border-subtle` — never a heavier decorative border.
- **Transparency/blur**: used sparingly — only on the dialog scrim (55% black + light blur) to focus attention. Never on cards or everyday surfaces.
- **Imagery**: none in the current UI kit — Countlink's interface is number-first and doesn't need photography or illustration. If a future app in this family needs imagery, keep it cool-toned and understated, matching the neutral palette, not warm/saturated stock photography.
- **Layout**: single centered column (max ~720px) for all core screens — this is a focused utility, not a wide dashboard. Header is a fixed top bar with wordmark + theme toggle + primary action.

## Iconography
No icon set or icon font was supplied. The system assumes a **Lucide-style outline icon set** (1.5–1.6px stroke, 20–24px grid, rounded caps/joins) — shown in `guidelines/iconography.card.html` — and the few icons used inline in components (share glyph in the Forms card) are drawn to match that spec. For real apps, link Lucide from CDN (`unpkg.com/lucide-static` or the React package) rather than hand-drawing more icons. No emoji, no unicode-symbol icons, aside from a plain `×` dismiss glyph on `Tag`.

## Brand mark
No logo file was supplied. `guidelines/brand-wordmark.card.html` shows the placeholder treatment: the wordmark set in Inter Bold + a small two-dot "link" glyph (two circles joined by a line — literally depicting "count" + "link"). Treat this as a starting point, not a final logo — replace with real brand assets if/when you have them.
