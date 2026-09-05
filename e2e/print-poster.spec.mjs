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

// A minimal, valid 1×1 PNG, so every test in this file is hermetic — it must
// not depend on api.qrserver.com actually being reachable from wherever this
// suite runs. That's not just about flake: a browser's real "broken image"
// placeholder for a failed network fetch produced a malformed image stream
// that made page.pdf() emit a PDF pdf-parse's parser choked on ("Command
// token too long"), in a CI sandbox with no outbound network access to that
// host — this mock is what actually fixed that, not a smaller page.pdf() or
// a retry.
test.beforeEach(async ({ page }) => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64"
  );
  await page.route("https://api.qrserver.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: png })
  );
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
    const src = await page.locator("#posterQr").getAttribute("src");
    expect(src).toMatch(/^https:\/\/api\.qrserver\.com\/v1\/create-qr-code\/\?size=320x320&data=/);
    // print-poster is removed again on "afterprint" — Playwright's no-op
    // print() still fires that event synchronously in Chromium/WebKit, so by
    // the time the click has resolved the class should already be gone; this
    // is really asserting the handler doesn't leave the page stuck in print
    // mode forever, which would break print-related on-screen CSS for real.
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
    // Same reasoning as the test above: set state directly rather than race
    // the click handler's async afterprint cleanup.
    await page.evaluate(() => {
      document.getElementById("posterLabel").textContent = "Standup";
      document.body.classList.add("print-poster");
    });
    await page.emulateMedia({ media: "print" });

    const pdf = await page.pdf({ path: "test-results/print-poster.pdf" });
    expect(pdf.length).toBeGreaterThan(500); // a real, non-empty PDF, not a blank stub

    // A poster spanning many print pages would mean the "hide everything,
    // fixed-position the poster" trick failed to contain the (invisible but
    // still laid-out) rest of the page — pdf-parse gives us actual page
    // count rather than guessing from byte size.
    const { default: pdfParse } = await import("pdf-parse");
    const parsed = await pdfParse(pdf);
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
