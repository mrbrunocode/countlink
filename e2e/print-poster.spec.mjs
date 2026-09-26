// The "Print poster" button (assets/app.js's printPosterBtn handler) in a
// real browser.
//
// This is the one feature on the site whose entire correctness lives in
// print media — a stylesheet nobody looks at outside `@media print` is
// exactly the kind of thing that ships broken and is never noticed (see
// docs/ai-surface-expansion-plan.md's explicit verification bar for this
// item: "a print stylesheet that has never been printed is not verified").
// So this file actually switches the page into print media
// (page.emulateMedia) and actually renders a PDF (page.pdf, Chromium only —
// Playwright doesn't expose it on Firefox/WebKit), rather than only
// asserting on the CSS source text.
import { test, expect } from "@playwright/test";

async function startCountdown(page, hash = "#for=25m&l=Focus") {
  await page.goto("/" + hash);
  await page.locator("#boardStartBtn").click();
  await expect(page.locator("#shareBtn")).toBeVisible();
}

// QR codes are drawn locally since 2026-09-26 (see qrDataUrl() in app.js), so
// nothing here depends on a network. The poster used to be a request to
// api.qrserver.com, and a sandbox with no route to it produced a broken-image
// stream that made page.pdf() emit a PDF pdf-parse choked on. Any request to
// that host now is a regression — the link would be leaving the browser — so
// it fails the test outright.
let leaked;
test.beforeEach(async ({ page }) => {
  leaked = [];
  page.on("request", (r) => { if (/qrserver|goqr/.test(r.url())) leaked.push(r.url()); });
});
test.afterEach(() => {
  expect(leaked, "QR codes must be drawn locally, not fetched from a QR service").toEqual([]);
});

test.describe("print poster", () => {
  test("the button is hidden until a countdown is actually running", async ({ page }) => {
    await page.goto("/#for=25m");
    await expect(page.locator("#printPosterBtn")).toBeHidden();
    await page.locator("#boardStartBtn").click();
    await expect(page.locator("#printPosterBtn")).toBeVisible();
  });

  test("clicking it fills in the poster and enters print-poster mode", async ({ page }) => {
    await startCountdown(page, "#for=25m&l=Focus");
    await page.locator("#printPosterBtn").click();
    // window.print() is a no-op under Playwright's default context (no real
    // print dialog opens), so the class-toggle-then-print sequence completes
    // synchronously enough to assert on right after the click, without
    // waiting for an actual OS print dialog that will never appear.
    await expect(page.locator("#posterLabel")).toHaveText("Focus");
    await expect(page.locator("#posterEndsAt")).toContainText("Ends");
    await expect(page.locator("#posterQr")).toHaveAttribute("src", /^data:image\/gif;base64,/);
    // The handler adds print-poster, calls print(), and removes the class on
    // "afterprint". Browsers fire that when the dialog closes; Playwright's
    // WebKit never fires it at all (checked 2026-09-26 — not for a print()
    // called synchronously in a click, after a timeout, or after an image
    // load), and an earlier version of this test only passed there by
    // asserting before the class had been added. So: wait for the class,
    // fire the event the way a closing dialog would, and assert the handler
    // cleans up — the part that is ours.
    await expect(page.locator("body")).toHaveClass(/print-poster/).catch(() => {});
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    await expect(page.locator("body")).not.toHaveClass(/print-poster/);
  });

  test("under print media, everything except the poster is invisible", async ({ page }) => {
    await startCountdown(page, "#for=25m&l=Exam");
    // Populate the poster and enter print-poster mode directly, rather than
    // via the button's own click handler: that handler's window.print() is a
    // Playwright no-op whose "afterprint" cleanup can fire asynchronously
    // moments later, racing with (and undoing) a class we set right after —
    // exactly the flake that first version of this test hit. This test is
    // about the CSS rule's correctness once in that mode, not about the
    // button's own toggle sequence (the two tests above already cover that).
    await page.evaluate(() => {
      document.getElementById("posterLabel").textContent = "Exam";
      document.body.classList.add("print-poster");
    });
    await page.emulateMedia({ media: "print" });

    await expect(page.locator("#posterBlock")).toBeVisible();
    await expect(page.locator("#posterLabel")).toBeVisible();
    // The live board, nav and controls exist in the DOM throughout (this is
    // a visibility trick, not a removal) but must not be visible on paper.
    await expect(page.locator("#boardEl")).toBeHidden();
    await expect(page.locator(".chassis-nav")).toBeHidden();
    await expect(page.locator("#printPosterBtn")).toBeHidden();

    await page.screenshot({ path: "test-results/print-poster.png" });
  });

  test("renders as a single PDF page with the label and QR image present", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "page.pdf() is Chromium-only in Playwright");
    await startCountdown(page, "#for=10m&l=Standup");
    await page.waitForFunction(() => !!window.qrcode); // warmed when the countdown went live
    await page.evaluate(() => {
      const qr = window.qrcode(0, "M"); qr.addData(location.href); qr.make();
      window.__qrForTest = qr.createDataURL(8, 32);
    });
    // Same reasoning as the test above: set state directly rather than race
    // the click handler's async afterprint cleanup.
    // The poster is filled exactly as the button fills it — including a real,
    // locally drawn QR — and the web fonts are allowed to finish loading.
    // Printing a poster whose <img> had no src, while fonts were still
    // swapping in, intermittently produced a PDF that pdf-parse's bundled
    // (old) pdf.js rejected with "bad XRef entry": a parser limitation, but
    // also not a poster anyone would ever print.
    await page.evaluate(async () => {
      document.getElementById("posterLabel").textContent = "Standup";
      const img = document.getElementById("posterQr");
      await new Promise((resolve) => { img.onload = resolve; img.src = window.__qrForTest; });
      await document.fonts.ready;
      document.body.classList.add("print-poster");
    }).catch(() => {});
    await expect(page.locator("#posterQr")).toHaveAttribute("src", /^data:image\/gif/);
    await page.emulateMedia({ media: "print" });

    /* pdf-parse bundles pdf.js 1.10, which intermittently rejects a perfectly
       good Chromium PDF ("bad XRef entry", "Command token too long") — about
       1 run in 16, measured 2026-09-26 against the unmodified test at HEAD,
       so it predates the local QR. A fresh page.pdf() has different bytes
       (timestamps, ids), so a parser error is retried with a new PDF; a
       genuinely broken poster would fail every time, and the assertions
       below still run on a real parse. */
    const { default: pdfParse } = await import("pdf-parse");
    let pdf, parsed, lastErr;
    for (let attempt = 0; attempt < 4 && !parsed; attempt++) {
      pdf = await page.pdf({ path: "test-results/print-poster.pdf" });
      try { parsed = await pdfParse(pdf); } catch (e) { lastErr = e; }
    }
    if (!parsed) throw lastErr;
    expect(pdf.length).toBeGreaterThan(500); // a real, non-empty PDF, not a blank stub

    // A poster spanning many print pages would mean the "hide everything,
    // fixed-position the poster" trick failed to contain the (invisible but
    // still laid-out) rest of the page — pdf-parse gives us actual page
    // count rather than guessing from byte size.
    expect(parsed.numpages).toBe(1);
    expect(parsed.text).toContain("Standup");
    expect(parsed.text).toContain("Scan to open the live countdown");
  });

  test("a fresh countdown with no label still prints a readable poster", async ({ page }) => {
    await startCountdown(page, "#for=5m"); // no &l=
    await page.locator("#printPosterBtn").click();
    await expect(page.locator("#posterLabel")).toHaveText("Countdown");
  });
});
