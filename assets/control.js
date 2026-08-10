/* control.html's entire logic — deliberately separate from app.js rather
   than a mode-flag bolted onto it: this page doesn't render split-flap
   tiles, doesn't have a setup form, and app.js's Node-test early-return
   (see its own top comment) would only get harder to reason about with a
   second, unrelated DOM shape mixed in. The two files share one thing on
   purpose: the wire protocol in realtime.js's header comment. */
(function () {
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.hash.slice(1));
  const rawT = +params.get("t");
  const label = decodeURIComponent(params.get("l") || "");
  const sessionId = params.get("c");
  const dirParam = params.get("d");

  $("ctrlLabel").textContent = label || "Countdown";

  function disableAll(msg) {
    $("ctrlStatus").textContent = msg;
    $("ctrlReadout").style.display = "none";
    document.querySelectorAll(".stage-btns .btn").forEach((b) => (b.disabled = true));
  }

  if (!sessionId || !window.CountlinkRealtime || !window.CountlinkRealtime.enabled) {
    disableAll("This link doesn't have phone control enabled.");
    return;
  }
  // Pause/adjust only exists for a plain countdown (see app.js's state-list
  // comment) — a stopwatch or interval link shouldn't even reach this page in
  // practice (start()/startUp()/startInterval() only ever set &c= in down
  // mode), but a hand-edited or corrupted URL could still carry one.
  if (dirParam === "up" || dirParam === "iv") {
    disableAll("Phone control only works for a plain countdown, not a stopwatch or interval timer.");
    return;
  }

  let end = Number.isFinite(rawT) ? rawT : Date.now();
  // Optimistic until the first "state" message arrives (own heartbeat or
  // this page's own actions) — if the countdown was already paused before
  // this page connected, the readout briefly shows "running" until that
  // first message lands, up to the ~4s heartbeat interval in app.js.
  let curState = "running";
  let pausedRemaining = 0;
  let tick = null;

  function fmt(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const p = (n) => String(n).padStart(2, "0");
    return h > 0 ? `${p(h)}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
  }
  function draw() {
    $("ctrlReadout").textContent = curState === "paused" ? fmt(pausedRemaining) : fmt(end - Date.now());
    $("pauseResumeBtn").textContent = curState === "paused" ? "Resume" : "Pause";
  }
  clearInterval(tick);
  tick = setInterval(draw, 250);
  draw();

  window.CountlinkRealtime.subscribeState(sessionId, (s) => {
    if (!s) return;
    if (s.label != null) $("ctrlLabel").textContent = s.label || "Countdown";
    if (s.state === "paused") {
      curState = "paused"; pausedRemaining = s.pausedRemaining || 0;
      $("ctrlStatus").textContent = "Paused";
    } else if (s.state === "running") {
      curState = "running"; if (s.end) end = s.end;
      $("ctrlStatus").textContent = "Live";
    } else if (s.state === "finished") {
      /* Finished is not stopped, and saying so was wrong twice over: the
         countdown ran its full course rather than being cut short, and the
         board on the other end is sitting on a live "Restart — same duration"
         button. Reporting it as a stop also disabled every control here, so
         the phone that had been running the session went dead the moment the
         session ended. Readout freezes at 00:00 and stop stays available (the
         board is still on screen), but pause/adjust are meaningless now. */
      curState = "finished";
      clearInterval(tick); tick = null;
      $("ctrlReadout").textContent = fmt(0);
      $("ctrlStatus").textContent = "Finished — time is up.";
      $("pauseResumeBtn").disabled = true;
      $("minusBtn").disabled = true;
      $("plusBtn").disabled = true;
      return;
    } else if (s.state === "ready") {
      curState = "stopped";
      clearInterval(tick); tick = null;
      disableAll("This countdown was stopped.");
      return;
    }
    draw();
  });

  $("pauseResumeBtn").addEventListener("click", () => {
    window.CountlinkRealtime.publishCommand(sessionId, { type: curState === "paused" ? "resume" : "pause" });
  });
  $("minusBtn").addEventListener("click", () => {
    window.CountlinkRealtime.publishCommand(sessionId, { type: "adjust", deltaMs: -60000 });
  });
  $("plusBtn").addEventListener("click", () => {
    window.CountlinkRealtime.publishCommand(sessionId, { type: "adjust", deltaMs: 60000 });
  });
  $("ctrlStopBtn").addEventListener("click", () => {
    if (!confirm("Stop this countdown on every connected screen?")) return;
    window.CountlinkRealtime.publishCommand(sessionId, { type: "stop" });
    $("ctrlStatus").textContent = "Stop sent.";
  });

  $("ctrlStatus").textContent = "Live";
})();
