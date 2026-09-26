// QR codes are drawn in the browser (qrDataUrl() in assets/app.js), not
// fetched from a third-party service. That's only an improvement if they
// SCAN — so each one is read back here with an independent decoder (jsQR)
// and must yield exactly the link it was drawn for. A QR that renders but
// decodes to something else is worse than no QR: someone points a phone at
// the projector and lands on the wrong countdown.
import { test, expect } from "@playwright/test";
import jsQR from "jsqr";

/** Decode the QR in an <img> by painting it onto a canvas in the page. */
async function decodeImg(page, selector) {
  await expect(page.locator(selector)).toHaveAttribute("src", /^data:image\//);
  const { w, h, data } = await page.evaluate(async (sel) => {
    const img = document.querySelector(sel);
    if (!img.complete) await new Promise((r) => (img.onload = r));
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height);
    return { w: c.width, h: c.height, data: Array.from(d.data) };
  }, selector);
  const out = jsQR(Uint8ClampedArray.from(data), w, h);
  return out && out.data;
}

test("the share-link QR decodes to exactly the share link, and nothing is fetched to draw it", async ({ page }) => {
  const external = [];
  page.on("request", (r) => { if (!r.url().startsWith("http://localhost")) external.push(r.url()); });
  await page.goto("/#for=25m&l=Caf%C3%A9%20%26%20quiz");
  await page.locator("#boardStartBtn").click();
  await page.locator("#qrBtn").click();
  const decoded = await decodeImg(page, "#qrImg");
  expect(decoded).toBe(await page.locator("#shareUrl").textContent());
  expect(external.filter((u) => /qrserver|goqr/i.test(u)), "the link must not leave the browser to be drawn").toEqual([]);
});

test("the control-link QR decodes to a control link carrying the key", async ({ page }) => {
  await page.route("https://cdn.ably.com/**", (route) => route.abort()); // no phone-control network needed to draw its QR
  await page.goto("/");
  await page.locator("#phoneControlToggle").check();
  await page.locator("#startBtn").click();
  await page.locator("#controlQrBtn").click();
  const decoded = await decodeImg(page, "#controlQrImg");
  expect(decoded).toMatch(/\/control\.html#t=\d+&k=[A-Za-z0-9_-]{22}$/);
});
