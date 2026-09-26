// WebMCP tools (registerAgentTools() in assets/app.js).
//
// No shipping browser exposes document.modelContext without a flag or an
// origin-trial token yet, so this stands in a minimal one — just enough of
// Chrome's API to capture what the page registers — and then calls the tools
// the way an agent would. What's asserted is the part that's ours: the tools
// are registered, their schemas are sane, and executing them does exactly
// what the page's own buttons do, including refusing to edit a sealed board.
import { test, expect } from "@playwright/test";
import { boardValue } from "./helpers.mjs";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__tools = {};
    document.modelContext = {
      registerTool(tool) { window.__tools[tool.name] = tool; return Promise.resolve(); },
    };
  });
});

const call = (page, name, args = {}) =>
  page.evaluate(async ([n, a]) => {
    try { return { ok: await window.__tools[n].execute(a) }; }
    catch (e) { return { error: String(e.message || e) }; }
  }, [name, args]);

test("the board registers its tools, with schemas an agent can use", async ({ page }) => {
  await page.goto("/");
  const tools = await page.evaluate(() => Object.values(window.__tools).map((t) => ({
    name: t.name, required: t.inputSchema.required || [], readOnly: !!(t.annotations && t.annotations.readOnlyHint),
  })));
  expect(tools.map((t) => t.name).sort()).toEqual(["get_countdown_status", "prepare_countdown", "start_shared_countdown", "stop_countdown"]);
  expect(tools.find((t) => t.name === "start_shared_countdown").required).toEqual(["duration"]);
  expect(tools.find((t) => t.name === "get_countdown_status").readOnly).toBe(true);
});

test("start_shared_countdown starts the board and returns a working share link and join code", async ({ page, browser }) => {
  await page.goto("/timers/meeting-timer");
  const res = await call(page, "start_shared_countdown", { duration: "7m", label: "Retro" });
  expect(res.error).toBeUndefined();
  expect(res.ok).toMatch(/running with 7 minutes left|running with 6 minutes 5\d seconds left/);
  const link = res.ok.match(/Share link[^:]*: (\S+)/)[1];
  expect(res.ok).toMatch(/Join code to read out: [0-9A-Z]{4,7}/);
  await expect(page.locator("#shareBtn")).toBeVisible();

  // The link is real: a second device opening it sees the same countdown.
  const other = await (await browser.newContext()).newPage();
  await other.goto(link);
  await expect(other.locator("#evtLabel")).toHaveText("Retro");
  await expect.poll(() => boardValue(other)).toMatch(/^0[67]:\d\d$/);
});

test("a nonsense duration is refused with a message, and nothing starts", async ({ page }) => {
  await page.goto("/");
  const res = await call(page, "start_shared_countdown", { duration: "soon-ish" });
  expect(res.error).toContain("isn't a duration");
  await expect(page.locator("#boardStartBtn")).toBeVisible();
});

test("prepare_countdown sets the board without starting it, and refuses while a countdown is live", async ({ page }) => {
  await page.goto("/");
  const res = await call(page, "prepare_countdown", { duration: "1:30:00", label: "Exam" });
  expect(res.ok).toContain("1 hour 30 minutes");
  expect(res.ok).toMatch(/#for=5400s&l=Exam/);
  await expect(page.locator("#boardStartBtn")).toBeVisible();
  await expect.poll(() => boardValue(page)).toBe("01:30:00");

  await page.locator("#boardStartBtn").click();
  const sealed = await call(page, "prepare_countdown", { duration: "5m" });
  expect(sealed.error).toContain("sealed");
});

test("get_countdown_status and stop_countdown report and act on this screen only", async ({ page }) => {
  await page.goto("/");
  expect((await call(page, "get_countdown_status")).ok).toContain("No countdown is running");
  await call(page, "start_shared_countdown", { duration: "5m" });
  expect((await call(page, "get_countdown_status")).ok).toMatch(/countdown is running with/);
  expect((await call(page, "stop_countdown")).ok).toContain("Stopped on this screen");
  await expect(page.locator("#boardStartBtn")).toBeVisible();
});

test("without the API, nothing is registered and nothing breaks", async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.locator("#boardStartBtn").click();
  await expect(page.locator("#shareBtn")).toBeVisible();
  expect(errors).toEqual([]);
});
