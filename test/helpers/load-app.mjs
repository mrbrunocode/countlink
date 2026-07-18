// assets/app.js is a classic (non-module) browser script — a plain
// top-level script, not even wrapped in an IIFE like diffhero/textbench are
// — so it can't be `import`ed or `require()`d directly. Wrap its source in a
// CJS function shell instead — the same trick Node itself uses to load
// CommonJS files — so its own `module.exports` shim (see the end of
// charsFor()'s definition in app.js) populates a real module object we can
// inspect.
//
// That shim runs before any DOM access happens (it's the very next
// statement after fmt2/charsFor are defined), so no `document` stub is
// needed here at all — unlike textbench, which has DOM reads earlier in its
// file before reaching its export point.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appJsPath = join(__dirname, "..", "..", "assets", "app.js");

export function loadDuration() {
  const src = readFileSync(appJsPath, "utf8");
  const mod = { exports: {} };
  const fn = new Function("module", "exports", "require", "__filename", "__dirname", src);
  fn(mod, mod.exports, createRequire(import.meta.url), appJsPath, dirname(appJsPath));
  return mod.exports;
}
