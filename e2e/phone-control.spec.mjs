// Phone control: who may drive a controlled countdown.
//
// WHY THIS FILE EXISTS
// Until 2026-09-26 the share link carried the only id phone control used, and
// every tab connected with one public Ably key. Anyone sent the link could
// open /control.html with it — or just keep the page open, since every viewer
// tab re-broadcast state — and pause, stop or flash text onto the room's
// projector. The unit tests (test/realtime.test.mjs) pin the crypto and the
// token endpoint; this file pins the behaviour a person sees: the viewer
// watches every change live and can cause none of them.
//
// HOW
// The real Ably SDK is swapped for a stand-in that obeys the one thing that
// matters here — the capability in the token the page got from the REAL
// /api/realtime-token (run in-process by the dev server; see
// playwright.config.mjs for the dummy ABLY_API_KEY it signs with). A publish
// without the "publish" capability is refused, exactly as Ably refuses it,
// and every attempt is logged so the test can assert nobody even tried.
// Messages are relayed between pages by this test process, so the viewer can
// live in a separate browser context with its own storage — a genuinely
// different device as far as the page can tell.
import { test, expect } from "@playwright/test";
import { boardValue } from "./helpers.mjs";

const FAKE_ABLY = `
(function(){
  const subs = {};
  window.__fakeAblyDeliver = (channel, event, data) => {
    (subs[channel + "|" + event] || []).forEach((h) => { try { h({ data }); } catch (e) {} });
  };
  class Channel {
    constructor(client, name) { this.client = client; this.name = name; }
    subscribe(event, handler) {
      this.client.ready.then(() => {
        const ops = (this.client.cap && this.client.cap[this.name]) || [];
        if (!ops.includes("subscribe")) return;
        (subs[this.name + "|" + event] = subs[this.name + "|" + event] || []).push(handler);
      });
    }
    unsubscribe(event, handler) {
      const k = this.name + "|" + event;
      subs[k] = (subs[k] || []).filter((h) => h !== handler);
    }
    publish(event, data) {
      return this.client.ready.then(() => {
        const ops = (this.client.cap && this.client.cap[this.name]) || [];
        const allowed = ops.includes("publish");
        window.__fakeAblyPublish({ channel: this.name, event, data, allowed });
        if (!allowed) throw new Error("40160 action not permitted");
      });
    }
  }
  window.Ably = { Realtime: class {
    constructor(opts) {
      this.ready = new Promise((res) => opts.authCallback({}, (err, tr) => {
        this.cap = err ? null : JSON.parse(tr.capability);
        window.__fakeAblyCaps = (window.__fakeAblyCaps || []).concat([this.cap]);
        res();
      }));
      const chans = {};
      this.channels = { get: (n) => (chans[n] = chans[n] || new Channel(this, n)) };
    }
    close() {}
  } };
})();`;

/** Wire a page into the relay. Returns nothing; the relay lives in `bus`. */
async function join(bus, page, role) {
  // Installed before any page script runs: realtime.js uses window.Ably if it
  // already exists and never fetches the SDK. (page.route() on the CDN URL
  // worked in Chromium and Firefox but not WebKit, which loaded the real SDK.)
  await page.addInitScript(FAKE_ABLY);
  await page.route("https://cdn.ably.com/**", (route) => route.abort());
  await page.exposeBinding("__fakeAblyPublish", async (_src, msg) => {
    bus.log.push({ role, ...msg });
    if (!msg.allowed) return;
    for (const p of bus.pages) {
      if (p === page || p.isClosed()) continue;
      await p.evaluate(({ channel, event, data }) => window.__fakeAblyDeliver && window.__fakeAblyDeliver(channel, event, data),
        { channel: msg.channel, event: msg.event, data: msg.data }).catch(() => {});
    }
  });
  bus.pages.push(page);
}

const newBus = () => ({ pages: [], log: [] });

async function startControlled(page, minutes = "10") {
  await page.goto("/");
  await page.locator("#customMin").fill(minutes);
  await page.locator("#customMin").dispatchEvent("input");
  await page.locator("#phoneControlToggle").check();
  await page.locator("#startBtn").click();
  await expect(page).toHaveURL(/#t=\d+/);
}

const hashParams = (url) => new URLSearchParams(new URL(url).hash.slice(1));

test.describe("phone control permissions", () => {
  test("the share link carries only the session id; the control link carries only the key", async ({ page }) => {
    const bus = newBus();
    await join(bus, page, "host");
    await startControlled(page);
    const share = hashParams(page.url());
    expect(share.get("c")).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(share.get("k"), "the key must never appear in the address bar").toBeNull();
    expect(await page.locator("#shareUrl").textContent()).not.toContain("k=");

    await expect(page.locator("#controlLinkWrap"), "the host is offered a control link").toBeVisible();

    // The host's token is publish-capable, on the channel its key derives to.
    await expect.poll(() => page.evaluate(() => window.__fakeAblyCaps && window.__fakeAblyCaps[0])).toBeTruthy();
    const caps = await page.evaluate(() => window.__fakeAblyCaps[0]);
    expect(caps).toEqual({ ["countlink:" + share.get("c")]: ["publish", "subscribe"] });
  });

  test("a viewer on another device watches live, is offered no control link, and never publishes", async ({ page, browser }) => {
    const bus = newBus();
    await join(bus, page, "host");
    await startControlled(page);
    const shareUrl = page.url();
    const sid = hashParams(shareUrl).get("c");

    const viewerCtx = await browser.newContext();
    const viewer = await viewerCtx.newPage();
    await join(bus, viewer, "viewer");
    await viewer.goto(shareUrl);
    await expect(viewer.locator("#syncDot")).toBeVisible();
    await expect.poll(() => viewer.evaluate(() => window.__fakeAblyCaps && window.__fakeAblyCaps[0])).toBeTruthy();
    expect(await viewer.evaluate(() => window.__fakeAblyCaps[0])).toEqual({ ["countlink:" + sid]: ["subscribe"] });
    await expect(viewer.locator("#controlLinkWrap")).toBeHidden();

    // Let a couple of heartbeats go by: the host's arrive; the viewer sends none.
    await page.waitForTimeout(4500);
    expect(bus.log.filter((m) => m.role === "viewer"), "a viewer must not even attempt to publish").toEqual([]);
    expect(bus.log.some((m) => m.role === "host" && m.event === "state")).toBe(true);
    await viewerCtx.close();
  });

  test("a viewer who presses Stop stops only their own screen", async ({ page, browser }) => {
    const bus = newBus();
    await join(bus, page, "host");
    await startControlled(page);

    const viewerCtx = await browser.newContext();
    const viewer = await viewerCtx.newPage();
    await join(bus, viewer, "viewer");
    await viewer.goto(page.url());
    await expect(viewer.locator("#stopBtn")).toBeVisible();
    await viewer.locator("#stopBtn").click();
    await expect(viewer.locator("#boardStartBtn")).toBeVisible();

    await page.waitForTimeout(500);
    await expect(page.locator("#stopBtn"), "the host's countdown must still be running").toHaveText("Stop");
    expect(bus.log.filter((m) => m.role === "viewer")).toEqual([]);
    await viewerCtx.close();
  });

  test("the share link opened as a control page grants nothing", async ({ page, browser }) => {
    const bus = newBus();
    await join(bus, page, "host");
    await startControlled(page);
    const hash = new URL(page.url()).hash;

    const ctx = await browser.newContext();
    const intruder = await ctx.newPage();
    await join(bus, intruder, "intruder");
    await intruder.goto("/control.html" + hash);
    await expect(intruder.locator("#ctrlStatus")).toContainText("can watch it but not control it");
    await expect(intruder.locator("#pauseResumeBtn")).toBeDisabled();
    await expect(intruder.locator("#flashSendBtn")).toBeDisabled();
    expect(bus.log.filter((m) => m.role === "intruder")).toEqual([]);
    await ctx.close();
  });

  test("the real control link pauses, adjusts and resumes the host and every viewer", async ({ page, browser }) => {
    const bus = newBus();
    await join(bus, page, "host");
    await startControlled(page);
    const t = hashParams(page.url()).get("t");
    const key = await page.evaluate(() => {
      const m = JSON.parse(localStorage.getItem("countlink_control_keys") || "{}");
      return Object.values(m)[0].k;
    });

    const viewerCtx = await browser.newContext();
    const viewer = await viewerCtx.newPage();
    await join(bus, viewer, "viewer");
    await viewer.goto(page.url());

    const phoneCtx = await browser.newContext();
    const phone = await phoneCtx.newPage();
    await join(bus, phone, "controller");
    await phone.goto(`/control.html#t=${t}&k=${key}`);
    await expect(phone.locator("#ctrlStatus")).toHaveText(/Live/, { timeout: 8000 });

    await phone.locator("#pauseResumeBtn").click();
    for (const p of [page, viewer]) await expect(p.locator("#syncMsg")).toContainText("Paused");
    await expect(phone.locator("#pauseResumeBtn")).toHaveText("Resume");

    await phone.locator("#pauseResumeBtn").click();
    for (const p of [page, viewer]) await expect(p.locator("#syncMsg")).toContainText("Anyone opening your link");

    // +1 min lands on both boards: 10:00 + 1:00, less the seconds elapsed.
    await phone.locator("#plusBtn").click();
    for (const p of [page, viewer]) {
      await expect.poll(() => boardValue(p), { timeout: 5000 }).toMatch(/^10:[0-5]\d$/);
    }

    // A flash message reaches every board and is written as text, not markup.
    await phone.locator("#flashInput").fill("<b>5 minutes</b> left");
    await phone.locator("#flashSendBtn").click();
    for (const p of [page, viewer]) {
      await expect(p.locator("#flashMsg")).toHaveText("<b>5 minutes</b> left");
      expect(await p.locator("#flashMsg b").count()).toBe(0);
    }

    await Promise.all([viewerCtx.close(), phoneCtx.close()]);
  });

  test("with the host board closed, the controller keeps late joiners in sync", async ({ page, browser }) => {
    test.setTimeout(40_000);
    const bus = newBus();
    await join(bus, page, "host");
    await startControlled(page);
    const shareUrl = page.url();
    const t = hashParams(shareUrl).get("t");
    const key = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem("countlink_control_keys")))[0].k);

    const phoneCtx = await browser.newContext();
    const phone = await phoneCtx.newPage();
    await join(bus, phone, "controller");
    await phone.goto(`/control.html#t=${t}&k=${key}`);
    await expect(phone.locator("#ctrlStatus")).toHaveText(/Live/, { timeout: 8000 });
    await phone.locator("#pauseResumeBtn").click();
    await expect(page.locator("#syncMsg")).toContainText("Paused");

    // The laptop that started it goes away. Nobody but the phone may publish now.
    await page.close();

    // A screen that opens the link AFTER the pause, from the un-paused share URL.
    const lateCtx = await browser.newContext();
    const late = await lateCtx.newPage();
    await join(bus, late, "late viewer");
    await late.goto(shareUrl);
    await expect(late.locator("#syncMsg"), "the controller's fallback heartbeat must reach it").toContainText("Paused", { timeout: 15000 });
    expect(bus.log.filter((m) => m.role === "late viewer")).toEqual([]);
    await Promise.all([phoneCtx.close(), lateCtx.close()]);
  });

  test("the host is still the host after reloading its own board", async ({ page }) => {
    const bus = newBus();
    await join(bus, page, "host");
    await startControlled(page);
    await page.reload();
    await expect(page.locator("#controlLinkWrap")).toBeVisible();
  });

  test("an old control link (c=, no key) explains itself instead of silently doing nothing", async ({ page }) => {
    await page.goto(`/control.html#t=${Date.now() + 600000}&l=Quiz&c=abc123defg`);
    await expect(page.locator("#ctrlStatus")).toContainText("older version");
    await expect(page.locator("#pauseResumeBtn")).toBeDisabled();
  });
});
