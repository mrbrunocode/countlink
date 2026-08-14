// Shared helpers for the cross-browser board suite.
//
// Everything here reads the board the way a person does — off the rendered
// flaps — rather than off internal state, so a test fails when the SCREEN is
// wrong, not merely when a variable is.

/** The digits currently shown, e.g. "10:00" or "01:30:00". */
export async function boardValue(page) {
  return page.evaluate(() => {
    const wrap = document.getElementById("tiles");
    const fields = [...wrap.querySelectorAll(".field")];
    // A sealed board has no .field wrappers — read its bare tiles instead.
    if (!fields.length) {
      const parts = [];
      let cur = "";
      for (const el of wrap.children) {
        if (el.classList.contains("tile-sep")) { parts.push(cur); cur = ""; continue; }
        if (el.classList.contains("tile")) cur += el.querySelector(".half.top .num").textContent;
      }
      if (cur) parts.push(cur);
      return parts.join(":");
    }
    return fields
      .map((f) => [...f.querySelectorAll(".half.top .num")].map((n) => n.textContent).join(""))
      .join(":");
  });
}

/** Which unit fields are on screen, e.g. "m,s" or "h,m,s". */
export function fieldKeys(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("#tiles .field")].map((f) => f.dataset.k).join(","));
}

/** Everything a viewer could possibly press inside the board's tile row. */
export function controlCensus(page) {
  return page.evaluate(() => {
    const t = document.getElementById("tiles");
    return {
      settable: document.getElementById("boardEl").classList.contains("settable"),
      spinbuttons: t.querySelectorAll('[role="spinbutton"]').length,
      chevrons: t.querySelectorAll(".chev").length,
      retract: t.querySelectorAll(".retract").length,
      ghost: t.querySelectorAll("#addHrsBtn").length,
      buttons: t.querySelectorAll("button").length,
      focusable: t.querySelectorAll('[tabindex="0"]').length,
    };
  });
}

export const field = (page, k) => page.locator(`#tiles .field[data-k="${k}"]`);
export const chev = (page, k, dir) => page.locator(`#tiles .field[data-k="${k}"] .chev.${dir}`);

/**
 * Reveal a field's chevrons and click one. The chevrons genuinely do not
 * exist on screen until the field is hovered or focused — that is the design,
 * so a test that clicks them cold is testing something no user can do.
 * Focusing works identically on pointer and touch, so this is the one path
 * every project can share.
 */
export async function roll(page, k, dir) {
  await field(page, k).focus();
  await chev(page, k, dir).click();
}

/** Type digits into the board, keypad style. Focuses the board first. */
export async function typeOnBoard(page, digits) {
  await field(page, "m").focus();
  for (const d of digits) await page.keyboard.press(d);
}

/** Seconds remaining according to the timestamp the share link encodes. */
export async function secondsFromHash(page) {
  return page.evaluate(() => {
    const m = location.hash.match(/t=(\d+)/);
    return m ? Math.round((+m[1] - Date.now()) / 1000) : null;
  });
}

/**
 * Paste `text` onto whatever currently has focus, using a REAL clipboard
 * round-trip: put the text in a throwaway input, select it, press copy, then
 * press paste over the target.
 *
 * A synthetic `new ClipboardEvent('paste', {clipboardData})` looked simpler and
 * is useless here — Firefox deliberately blanks clipboardData on events the
 * page constructs itself (verified: DataTransfer.setData round-trips, but the
 * event's clipboardData reads back ""), while WebKit and Chromium allow it. So
 * the synthetic version tests the handler in two engines and silently tests
 * nothing in the third. Driving the actual clipboard exercises the same path a
 * person does, in all three.
 */
export async function pasteText(page, text) {
  const focusSel = await page.evaluate(() => {
    const a = document.activeElement;
    if (!a) return null;
    if (a.id) return "#" + a.id;
    if (a.classList.contains("field")) return `#tiles .field[data-k="${a.dataset.k}"]`;
    return null;
  });

  await page.evaluate((t) => {
    const i = document.createElement("input");
    i.id = "__e2e_clip";
    i.value = t;
    // Off-screen but genuinely focusable — display:none can't be selected.
    i.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
    document.body.appendChild(i);
    i.focus();
    i.select();
  }, text);

  await page.keyboard.press("ControlOrMeta+C");
  await page.evaluate(() => document.getElementById("__e2e_clip")?.remove());

  if (focusSel) await page.locator(focusSel).focus();
  await page.keyboard.press("ControlOrMeta+V");
}

/** Click a preset in the setup panel below the board. */
export async function preset(page, minutes) {
  await page.locator(`.q[data-min="${minutes}"]`).click();
}
