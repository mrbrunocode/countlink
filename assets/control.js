/* control.html's entire logic — deliberately separate from app.js rather
   than a mode-flag bolted onto it: this page doesn't render split-flap
   tiles, doesn't have a setup form, and app.js's Node-test early-return
   (see its own top comment) would only get harder to reason about with a
   second, unrelated DOM shape mixed in. The two files share the wire
   protocol in realtime.js's header comment, and clock.js for "now". */
(function () {
  const $ = (id) => document.getElementById(id);
  const now = () => (window.CountlinkClock ? window.CountlinkClock.now() : Date.now());
  const RT = window.CountlinkRealtime;

  /* Read the label straight off the raw hash and decode exactly once.
     URLSearchParams.get() has already percent-decoded, so calling
     decodeURIComponent() on its result decoded TWICE — a label with a literal
     % ("50% done", "20% off") made the second pass throw URIError right here,
     at the top of the IIFE, taking down every control handler below it. Same
     double-decode bug, same fix, as labelFromHash() in app.js and labelOf()
     in functions/mcp.js. */
  function labelFromHash(hashStr) {
    const m = String(hashStr == null ? "" : hashStr).replace(/^#/, "").match(/(?:^|&)l=([^&]*)/);
    if (!m) return "";
    try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; }
  }

  const params = new URLSearchParams(location.hash.slice(1));
  const rawT = params.get("t");
  const label = labelFromHash(location.hash);
  const key = params.get("k");
  const dirParam = params.get("d");

  let curLabel = label;
  $("ctrlLabel").textContent = curLabel || "Countdown";

  function disableAll(msg) {
    $("ctrlStatus").textContent = msg;
    $("ctrlReadout").style.display = "none";
    document.querySelectorAll(".stage-btns .btn").forEach((b) => (b.disabled = true));
    if ($("flashInput")) $("flashInput").disabled = true;
  }

  if (!RT || !RT.enabled) {
    disableAll("Phone control isn't available on this site right now.");
    return;
  }
  /* A control link from before 2026-09-26 carries the bare session id (c=)
     and no key. That id was also in every viewer's share link, which is
     exactly why it no longer grants control — so say what to do instead of
     showing buttons that would silently do nothing. */
  if (!key && params.get("c")) {
    disableAll(RT.isSid(params.get("c"))
      // A current share link, pasted here: it can watch, not drive.
      ? "This is the countdown's share link, which can watch it but not control it. Use the control link from the screen that started the countdown."
      : "This control link is from an older version of CountLink. Start the countdown again with phone control ticked to get a new one.");
    return;
  }
  const cred = key ? RT.credFor(RT.deriveSid(key), key) : null;
  if (!cred || !cred.key) {
    disableAll("This link doesn't have phone control enabled.");
    return;
  }
  // Pause/adjust only exists for a plain countdown (see app.js's state-list
  // comment) — a stopwatch or interval link shouldn't even reach this page in
  // practice, but a hand-edited or corrupted URL could still carry one.
  if (dirParam === "up" || dirParam === "iv") {
    disableAll("Phone control only works for a plain countdown, not a stopwatch or interval timer.");
    return;
  }

  /* The controller's own model of the countdown. It starts from the link
     (running, to the link's deadline) but is UNCONFIRMED until the first
     state broadcast arrives — the countdown may well be paused already. */
  const tNum = rawT === null || rawT === "" ? NaN : +rawT;
  let end = Number.isFinite(tNum) ? tNum : now();
  let curState = "running";
  let pausedRemaining = 0;
  let confirmed = false;     // heard at least one real state broadcast
  let lastHeardAt = 0;       // when a key-holder (host board or another controller) last spoke
  let tick = null;

  const HEARTBEAT_MS = 4000, HOST_SILENT_MS = 6000, NO_BOARD_HINT_MS = 8000;

  function fmt(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const p = (n) => String(n).padStart(2, "0");
    return h > 0 ? `${p(h)}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
  }
  function effectiveState() {
    return curState === "running" && end <= now() ? "finished" : curState;
  }
  function draw() {
    const st = effectiveState();
    $("ctrlReadout").textContent = st === "paused" ? fmt(pausedRemaining) : fmt(end - now());
    $("pauseResumeBtn").textContent = st === "paused" ? "Resume" : "Pause";
    const liveControls = st === "running" || st === "paused";
    $("pauseResumeBtn").disabled = !liveControls;
    $("minusBtn").disabled = !liveControls;
    $("plusBtn").disabled = !liveControls;
    if (st === "finished" && confirmed) $("ctrlStatus").textContent = "Finished — time is up.";
  }
  tick = setInterval(draw, 250);
  draw();

  function setStatus(msg) { $("ctrlStatus").textContent = msg; }
  setStatus("Connecting…");
  setTimeout(() => {
    if (!confirmed) setStatus("Connected — waiting to hear from the board. Is the countdown open on a screen?");
  }, NO_BOARD_HINT_MS);

  RT.subscribeState(cred, (s) => {
    if (!s) return;
    lastHeardAt = Date.now();
    confirmed = true;
    if (s.label != null) { curLabel = s.label; $("ctrlLabel").textContent = curLabel || "Countdown"; }
    if (s.state === "paused") {
      curState = "paused"; pausedRemaining = s.pausedRemaining || 0;
      setStatus("Paused");
    } else if (s.state === "running") {
      curState = "running"; if (s.end) end = s.end;
      setStatus("Live");
    } else if (s.state === "finished") {
      /* Finished is not stopped: the countdown ran its full course, and the
         board on the other end is sitting on a live "Restart" button. Stop
         stays available; pause/adjust are meaningless now (draw() disables
         them from effectiveState()). */
      curState = "running";
      if (s.end) end = Math.min(s.end, now());
      setStatus("Finished — time is up.");
    } else if (s.state === "ready") {
      curState = "stopped";
      clearInterval(tick); tick = null;
      disableAll("This countdown was stopped.");
      return;
    }
    draw();
  });

  /* Fallback heartbeat. The host board normally broadcasts state every 4s,
     which is how a screen that opens the link late catches up. If the host
     board is closed — the teacher started it on a laptop, then walked off
     with the laptop — nobody else is allowed to publish, so this page, the
     only other key-holder, takes over. Only once its model has been
     confirmed by a real broadcast: an unconfirmed model is a guess from the
     link, and broadcasting a guess could un-pause every screen. */
  setInterval(() => {
    if (!confirmed || curState === "stopped") return;
    if (Date.now() - lastHeardAt < HOST_SILENT_MS) return;
    publishState();
  }, HEARTBEAT_MS);

  function publishState() {
    const st = effectiveState();
    RT.publishState(cred, {
      end: end,
      label: curLabel,
      state: st,
      pausedRemaining: pausedRemaining,
    });
  }

  /* Apply our own command to our own model straight away, so the readout
     answers the tap instead of waiting for the board's reply. The board's
     broadcast, when it comes, overwrites this with its own figures; the
     arithmetic mirrors app.js's clampAdjustedEnd/clampAdjustedRemaining. */
  function applyLocally(cmd) {
    const t = now();
    if (cmd.type === "pause" && curState === "running") {
      pausedRemaining = Math.max(0, end - t); curState = "paused"; setStatus("Paused");
    } else if (cmd.type === "resume" && curState === "paused") {
      end = t + pausedRemaining; curState = "running"; setStatus("Live");
    } else if (cmd.type === "adjust") {
      if (curState === "paused") pausedRemaining = Math.max(1000, pausedRemaining + cmd.deltaMs);
      else if (curState === "running") end = Math.max(t + 1000, end + cmd.deltaMs);
    }
    draw();
    // With no host board to answer, tell late joiners now, not in 4s.
    if (confirmed && Date.now() - lastHeardAt >= HOST_SILENT_MS) publishState();
  }

  // One event name with an `action` param rather than five distinct events —
  // this page has no other GA4 events to disambiguate against, and it keeps
  // "how is phone control actually used" a single report instead of five.
  function trackControl(action) {
    if (typeof gtag === "function") gtag("event", "phone_control_action", { action: action });
  }
  function send(cmd, action) {
    trackControl(action);
    RT.publishCommand(cred, cmd);
    applyLocally(cmd);
  }

  $("pauseResumeBtn").addEventListener("click", () => {
    const action = effectiveState() === "paused" ? "resume" : "pause";
    send({ type: action }, action);
  });
  $("minusBtn").addEventListener("click", () => send({ type: "adjust", deltaMs: -60000 }, "adjust_minus"));
  $("plusBtn").addEventListener("click", () => send({ type: "adjust", deltaMs: 60000 }, "adjust_plus"));
  $("ctrlStopBtn").addEventListener("click", () => {
    if (!confirm("Stop this countdown on every connected screen?")) return;
    trackControl("stop");
    RT.publishCommand(cred, { type: "stop" });
    // The board answers a stop with a "ready" broadcast, which disables this
    // page. With no board open, say so here — nothing else will.
    RT.publishState(cred, { end: end, label: curLabel, state: "ready", pausedRemaining: 0 });
    curState = "stopped";
    clearInterval(tick); tick = null;
    disableAll("Stop sent.");
  });

  /* Same cap/cleanup rule as app.js's sanitizeFlashText, kept as its own
     small copy rather than an import — this file deliberately shares no JS
     with app.js, only the wire protocol (see the top-of-file comment). The
     board re-sanitizes independently on arrival regardless, so this copy
     only has to be good enough to keep an obviously-malformed message off
     the wire in the first place, not to be the sole source of truth. */
  const FLASH_MAX_LEN = 60;
  function cleanFlashText(raw) {
    return String(raw || "").replace(/[\x00-\x1f\x7f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, FLASH_MAX_LEN);
  }
  function sendFlash() {
    const text = cleanFlashText($("flashInput").value);
    if (!text) return;
    trackControl("flash");
    RT.publishCommand(cred, { type: "flash", text });
    $("flashInput").value = "";
    $("flashHint").textContent = "Sent.";
    setTimeout(() => {
      $("flashHint").textContent = "Blinks briefly on every connected screen, then disappears on its own.";
    }, 1800);
  }
  $("flashSendBtn").addEventListener("click", sendFlash);
  $("flashInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); sendFlash(); }
  });
})();
