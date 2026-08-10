/* Phone-control pub/sub — thin wrapper around Ably's client SDK.
   See realtime-config.js for the on/off switch. The Ably script itself is
   fetched lazily, only the first time something here actually needs a
   connection (a board with a session id in its link, or the control page) —
   a plain shared link with no phone control enabled never touches this file
   at all beyond the no-op checks below.

   Channel protocol (namespaced "countlink:<sessionId>" so unrelated countdowns
   never cross-talk):
     - "command" events: control.html -> board. {type:"pause"|"resume"|"stop"}
       or {type:"adjust", deltaMs}.
     - "state" events: board -> everyone (other viewers with the same link,
       and the controller). {end, label, state, pausedRemaining}. The board
       is the only thing that ever applies a command; everyone else just
       renders whatever state it broadcasts. See app.js applyRemoteCommand(). */
(function () {
  const KEY = window.COUNTLINK_ABLY_KEY || "";
  const CDN_URL = "https://cdn.ably.com/lib/ably.min-2.js";
  let ablyPromise = null;
  let realtimeClient = null;

  function loadAblyScript() {
    if (ablyPromise) return ablyPromise;
    ablyPromise = new Promise((resolve, reject) => {
      if (window.Ably) { resolve(window.Ably); return; }
      const s = document.createElement("script");
      s.src = CDN_URL;
      s.onload = () => resolve(window.Ably);
      s.onerror = () => reject(new Error("Ably script failed to load"));
      document.head.appendChild(s);
    });
    return ablyPromise;
  }

  function client() {
    if (!KEY) return Promise.reject(new Error("phone control not configured"));
    if (realtimeClient) return Promise.resolve(realtimeClient);
    return loadAblyScript().then((Ably) => {
      // echoMessages:false — every connected tab both applies commands and
      // rebroadcasts state (see app.js connectRealtimeIfNeeded()), so without
      // this a tab would immediately re-receive and reprocess its own
      // broadcast. Harmless (idempotent) but pointless network chatter.
      realtimeClient = new Ably.Realtime({ key: KEY, echoMessages: false });
      return realtimeClient;
    });
  }

  function channelFor(sessionId) {
    return "countlink:" + sessionId;
  }

  // Every method below fails silently (network hiccup, ad-blocker, bad key,
  // Ably outage) rather than throwing — phone control is an enhancement on
  // top of the link-is-the-timer mechanic, never something whose failure
  // should be able to break the countdown itself.
  window.CountlinkRealtime = {
    enabled: !!KEY,

    /* Both subscribe* methods below unsubscribe by (event, listener) rather
       than the bare ch.unsubscribe() they used to call. rt.channels.get()
       returns the SAME channel object for a given name, so "state" and
       "command" share one channel — and a no-argument unsubscribe() detaches
       every listener on it. Tearing down the state subscription therefore
       silently killed command handling too. Nothing has caught fire yet only
       because app.js's disconnectRealtime() happens to drop both together;
       any future caller that drops one would have lost the other. */
    subscribeState(sessionId, onState) {
      if (!KEY || !sessionId) return () => {};
      let closed = false, ch = null;
      const handler = (msg) => { if (!closed) onState(msg.data); };
      client().then((rt) => {
        if (closed) return;
        ch = rt.channels.get(channelFor(sessionId));
        ch.subscribe("state", handler);
      }).catch(() => {});
      return () => { closed = true; if (ch) ch.unsubscribe("state", handler); };
    },

    publishState(sessionId, state) {
      if (!KEY || !sessionId) return;
      client().then((rt) => rt.channels.get(channelFor(sessionId)).publish("state", state)).catch(() => {});
    },

    subscribeCommands(sessionId, onCommand) {
      if (!KEY || !sessionId) return () => {};
      let closed = false, ch = null;
      const handler = (msg) => { if (!closed) onCommand(msg.data); };
      client().then((rt) => {
        if (closed) return;
        ch = rt.channels.get(channelFor(sessionId));
        ch.subscribe("command", handler);
      }).catch(() => {});
      return () => { closed = true; if (ch) ch.unsubscribe("command", handler); };
    },

    publishCommand(sessionId, cmd) {
      if (!KEY || !sessionId) return;
      client().then((rt) => rt.channels.get(channelFor(sessionId)).publish("command", cmd)).catch(() => {});
    },
  };
})();
