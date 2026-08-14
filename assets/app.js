/* CountLink — split-flap countdown logic. Shared by index.html and every /timers/*.html page. */
(function(){

const $=id=>document.getElementById(id);
let end=null,label="",sound=true,fired=false,tick=null,total=0;
let alarmTone="chime";
try{alarmTone=localStorage.getItem("samesecond_alarm_tone")||"chime"}catch(e){}
let mode=null;        // "hms" | "ms" | "days" — decided once per start() so tile count stays fixed
let prevValues=null;  // last rendered digit string per tile, so we only flip tiles that changed
let audioCtx=null;
let direction="down"; // "down" (countdown) | "up" (stopwatch/count-up) | "interval" (repeating work/rest cycle).
                      // In "up" and "interval" modes, `end` holds the START instant instead of
                      // the deadline — same single timestamp-in-the-link mechanic, just read
                      // the other way; "interval" additionally derives which phase/round is
                      // current from elapsed time, rather than counting to one fixed deadline.
let ivWork=20,ivRest=10,ivRounds=8; // interval mode: work/rest seconds per round, total rounds
/* Which work/rest phase draw() last rendered, as "<round><w|r>" — the only
   thing that tells a 250ms frame it has crossed a round boundary and owes a
   beep. null means "nothing rendered yet", which suppresses the cue on the
   first frame after a start or after opening a shared link mid-round. */
let ivPhaseKey=null;
/* The board has four lifecycle states, driving which buttons show:
   "ready"    — nothing running; preset duration displayed; Start lives ON the board
   "running"  — counting; Share/Stop replace Start
   "paused"   — down-mode only, and only reachable via a phone-control command
                (see realtime.js/control.html) — frozen tiles, Stop still works
   "finished" — hit zero; Restart (same duration) + New timer offered.
   Pages no longer auto-start on load — someone landing from a search result
   decides when their five minutes begin, instead of finding 30 seconds
   already gone by the time they've read the page. */
let state="ready";
/* Phone control (see realtime.js, control.html, realtime-config.js): entirely
   optional and off by default (COUNTLINK_ABLY_KEY empty). controlSession is
   the channel id shared between this board and its controller; null means
   "no phone control on this countdown", and every realtime code path below
   guards on it being set. pausedRemaining is the frozen ms-left snapshot
   taken the instant a "pause" command lands — direction "down" only, since
   a moving reference point (stopwatch elapsed / interval cycle position)
   doesn't have a single clean "remaining" value to freeze the same way. */
let controlSession=null,pausedRemaining=0,hashPausedRemaining=null;
/* Settable board: the duration currently shown on a READY board, in seconds,
   or null for "the board hasn't been touched — use the form". Non-null makes
   the board authoritative over #customMin at start, which is what lets someone
   set 7:30 on the flaps and just press Start. Every form control that changes
   the duration routes through renderReady(), which resets this, so the two can
   never silently disagree. */
let boardTotal=null,boardTypeBuf="";
let unsubRealtimeState=null,unsubRealtimeCommands=null,realtimeHeartbeat=null;

// Exposes the pure duration-formatting functions to Node's test runner (see
// test/duration.test.mjs). Placed here, after every `let`/`const` above is
// initialized (referencing `mode` before its own `let mode=null;` runs
// would throw — the temporal dead zone applies even to a function that
// only reads it once called, if that call happens before init), but before
// any DOM access below. fmt2/charsFor are declared further down but, like
// every function in this file, hoisted to the top of this IIFE's scope, so
// they're already callable here. This whole file used to be a bare
// top-level script (not wrapped in a function) — it's wrapped here purely
// so this early-return trick works, exactly like diffhero/textbench do.
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    fmt2: fmt2, charsFor: charsFor, numOr: numOr, validTimestamp: validTimestamp,
    pickMinutes: pickMinutes, modeForHash: modeForHash, intervalPhase: intervalPhase,
    remoteStateAction: remoteStateAction, esc: esc,
    encodeAgendaHash: encodeAgendaHash, parseAgendaHash: parseAgendaHash,
    boundaries: boundaries, fmtAgenda: fmtAgenda, computeAgendaState: computeAgendaState,
    alarmTones: alarmTones,
    clampAdjustedEnd: clampAdjustedEnd, clampAdjustedRemaining: clampAdjustedRemaining,
    computeResumeEnd: computeResumeEnd, genSessionId: genSessionId,
    // settable board (see "the duration model" block below charsFor)
    clampTotalSeconds: clampTotalSeconds, fieldsFromTotal: fieldsFromTotal,
    totalFromFields: totalFromFields, needsHours: needsHours,
    parseKeypadDigits: parseKeypadDigits, bumpTotal: bumpTotal,
    parsePastedDuration: parsePastedDuration, maxSettable: maxSettable,
  };
  return;
}

// Installable/offline shell: registers the service worker that caches
// style.css/app.js/the icon (see sw.js) so the board itself works offline
// once a page has loaded once. Deliberately never caches HTML pages — see
// sw.js's own comment for why. Silently no-ops in browsers without SW support.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

function fmt2(n){return String(n).padStart(2,"0")}

/* One escaper for every innerHTML interpolation in this file. There were
   three near-copies before — two inline in template literals, one local to
   the agenda dashboard — and all three covered only <>& , which is enough
   for text between tags but not for a value going into an attribute, where
   an unescaped quote ends the attribute early. Quotes are included here so
   there's one rule to remember rather than two. */
function esc(s){
  return String(s==null?"":s).replace(/[<>&"']/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&#39;"}[c]));
}

/* Copy-to-clipboard, for a site whose single most important interaction is
   "copy the link and send it". Every call site used to be a bare
   `await navigator.clipboard.writeText(x)` with nothing around it, and that
   promise rejects for reasons that have nothing to do with the user doing
   anything wrong: a non-secure context (any plain-http origin, which is how
   this gets opened on a LAN — http://192.168.x.x — for a projector), Safari
   losing the user-gesture association across an await, or a permissions
   policy in the iframe the embed runs in. On rejection the button did
   nothing at all: no copy, no message, no error — the primary action of the
   product silently failing.
   Falls back to the old execCommand path (still the only thing that works in
   a non-secure context), and returns false if even that fails so the caller
   can say so rather than claim success. */
async function copyText(text){
  try{
    if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(text);return true;}
  }catch(e){/* fall through to the legacy path below */}
  try{
    const ta=document.createElement("textarea");
    ta.value=text;
    ta.setAttribute("readonly","");
    // Off-screen but still focusable/selectable — display:none or
    // visibility:hidden would make execCommand("copy") a no-op.
    ta.style.cssText="position:fixed;top:0;left:-9999px;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    const ok=document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }catch(e){return false;}
}
/* Shared "did it work?" feedback so no button can claim "Copied ✓" after a
   failed copy — the one thing worse than a copy that fails is a copy that
   fails and says it didn't. */
function flashCopyResult(btn,okText,failText){
  return ok=>{
    const orig=btn.textContent;
    btn.textContent=ok?okText:failText;
    btn.classList.toggle("copied",ok);
    setTimeout(()=>{btn.textContent=orig;btn.classList.remove("copied");},ok?1800:3200);
    return ok;
  };
}

// Reads a user-editable numeric field/URL-param, falling back to `fallback`
// only when the raw value is missing/blank/non-numeric — NOT via `raw||fallback`,
// which silently discards an intentionally-entered 0 (falsy) and substitutes
// an unrelated default instead. Found via live testing: entering 0 rest-seconds
// on an interval timer (an explicitly supported "back-to-back rounds" case per
// this site's own FAQ) or 0 minutes on the multi-timer dashboard both got
// silently bumped to the field's fallback constant instead of being clamped by
// the caller's own Math.max(...) — the exact bug the `||` pattern was hiding.
function numOr(raw,fallback){
  if(raw===null||raw===undefined||raw==="")return fallback;
  const n=+raw;
  return Number.isNaN(n)?fallback:n;
}

/* The one place the "how many minutes is this form asking for" question gets
   answered. It used to be answered inline at four call sites with three
   different hardcoded fallbacks — `+$("customMin").value||10` when previewing
   the ready board, `||25` when actually starting, `||10` again on stop. So
   clearing the minutes field and pressing Start gave you a board that had
   been previewing 10:00 and a countdown that ran for 25:00. Neither number
   was even right: the page's own advertised duration (COUNTLINK_DEFAULT, the
   25 on /timers/pomodoro-timer, the 10 on the homepage) is what a blank field
   should fall back to, and now does.
   Pure half, exported and tested; `0` clamps to 1 to match renderReady()'s
   own Math.max(1,min) rather than starting a countdown that's already over. */
/* Tile-layout mode for a board booted from a shared link rather than from
   start()/startUp() — pure so the three directions can be asserted directly
   (see test/duration.test.mjs), which is how the "up" case below is pinned.

   "up" MUST be forced to "hms" for the same reason startUp() hardcodes it:
   6 tiles, because an open-ended stopwatch runs past an hour. It has to be
   said again here because in "up" mode `end` holds the START instant, so the
   caller's `total` is NEGATIVE and every threshold below falls through to
   "ms". That gave the *recipient* of a shared stopwatch link a 4-tile mm:ss
   board while the sender's own screen showed hh:mm:ss — at 1h41m elapsed the
   two read "10:45" and "01:41:45". A tool whose entire promise is that
   everyone sees the identical timer was showing two people different numbers
   off one link, and the shorter one was wrong.

   "interval" always renders through an explicit "ms" override in draw(), so
   its value here is cosmetic; set for consistency. */
function modeForHash(direction,total){
  if(direction==="up")return "hms";
  if(direction==="interval")return "ms";
  return total>=86400000?"days":total>=3600000?"hms":"ms";
}
/* Interval mode's whole derivation — which round, which phase, how much of it
   is left — as a pure function of elapsed time, so it's testable without a
   clock or a DOM (see test/interval.test.mjs).

   The urgency rule is the reason this got extracted. It used to be a bare
   `phaseLeftMs<=10000`, which quietly assumed every phase is comfortably
   longer than 10 seconds. On this site's own advertised Tabata default —
   20s work, 10s rest — the rest phase is 10s, so it was urgent from its first
   frame to its last, and work was urgent for half its length. The board
   pulsed red essentially non-stop, which is the opposite of an escalation:
   a signal that's always on carries no information. Anything 20s or shorter
   IS the urgent part already, so it gets no pulse; longer phases keep the
   final-10-seconds escalation they were designed for. */
function intervalPhase(workSec,restSec,rounds,elapsedMs){
  // Thresholds live INSIDE the function on purpose. Module-level `const`s
  // declared below the test-export early return (see this file's header) are
  // still in their temporal dead zone when a test calls in, so a top-level
  // URGENT_MS here threw ReferenceError under the test runner while working
  // fine in a browser — the exact hazard that comment describes.
  const URGENT_MS=10000, URGENT_MIN_PHASE_MS=20000;
  const cycleMs=(workSec+restSec)*1000;
  if(elapsedMs>=cycleMs*rounds)return {done:true,round:rounds,inWork:false,phaseLeftMs:0,phaseTotalMs:0,urgent:false};
  const posMs=elapsedMs%cycleMs;
  const inWork=posMs<workSec*1000;
  const phaseTotalMs=(inWork?workSec:restSec)*1000;
  const phaseLeftMs=inWork?workSec*1000-posMs:cycleMs-posMs;
  return {
    done:false,
    round:Math.floor(elapsedMs/cycleMs)+1,
    inWork:inWork,
    phaseTotalMs:phaseTotalMs,
    phaseLeftMs:phaseLeftMs,
    urgent:phaseTotalMs>URGENT_MIN_PHASE_MS&&phaseLeftMs<=URGENT_MS,
  };
}
function pickMinutes(raw,pageDefault){
  const n=numOr(raw,pageDefault);
  return n>=1?n:1;
}
function formMinutes(){
  const d=window.COUNTLINK_DEFAULT||{};
  const el=$("customMin");
  return pickMinutes(el&&el.value,d.minutes||10);
}
function setDefaultUntil(){
  const d=new Date(Date.now()+3600e3);d.setSeconds(0,0);
  const p=n=>String(n).padStart(2,"0");
  $("untilTime").value=`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function makeLink(){
  const u=new URL(location.href);
  const dirParam=direction==="up"?"&d=up":direction==="interval"?`&d=iv&w=${ivWork}&r=${ivRest}&n=${ivRounds}`:"";
  const ctrlParam=controlSession?`&c=${controlSession}`:"";
  const pauseParam=(state==="paused")?`&p=${Math.round(pausedRemaining)}`:"";
  u.hash=`t=${end}&l=${encodeURIComponent(label)}${dirParam}${ctrlParam}${pauseParam}`;
  return u.toString();
}
/* The controller (control.html) needs the same t/l/c — but never d/p, since
   phone control only exists for down-mode and the controller tracks
   paused-ness itself from live state broadcasts, not from a URL snapshot. */
function makeControlLink(){
  if(!controlSession)return "";
  const u=new URL(location.origin+"/control.html");
  u.hash=`t=${end}&l=${encodeURIComponent(label)}&c=${controlSession}`;
  return u.toString();
}
// A link that's been truncated by a chat client, hand-edited, or just
// corrupted in transit can leave #t= empty or non-numeric. Pulled out as a
// pure function so it's unit-testable without stubbing `location` — the bug
// this guards against (end=NaN silently propagating into "Na:Na" tiles on
// the board) was found by testing charsFor(NaN,...) directly, not by any
// interaction a normal test would think to try.
function validTimestamp(raw){
  const t=+raw;
  return raw!==null&&raw!==""&&Number.isFinite(t)?t:null;
}
function readHash(){
  const m=new URLSearchParams(location.hash.slice(1));
  const t=validTimestamp(m.get("t"));
  if(t!==null){
    end=t;label=decodeURIComponent(m.get("l")||"");
    if(m.get("d")==="up")direction="up";
    else if(m.get("d")==="iv"){
      direction="interval";
      ivWork=Math.max(1,numOr(m.get("w"),20));ivRest=Math.max(0,numOr(m.get("r"),10));ivRounds=Math.max(1,numOr(m.get("n"),8));
    }else direction="down";
    controlSession=m.get("c")||null;
    // Only down-mode countdowns support pause — see the state-list comment
    // near `let state="ready"` above for why.
    const p=m.get("p");
    hashPausedRemaining=(p!=null&&direction==="down")?Math.max(0,+p):null;
    return true;
  }
  return false;
}

/* ---------- phone-control pure helpers (see realtime.js, control.html) ----------
   Kept separate from the Ably wiring itself so the actual arithmetic — the
   part a bug would be embarrassing in, like a pause that leaks negative
   time — is unit-testable without a network or a fake pub/sub client. */
function clampAdjustedEnd(end,now,deltaMs){
  return Math.max(now+1000,end+deltaMs);
}
function clampAdjustedRemaining(remaining,deltaMs){
  return Math.max(1000,remaining+deltaMs);
}
function computeResumeEnd(now,remaining){
  return now+remaining;
}
// Not a security token — just a channel name unlikely enough to guess that
// a stranger can't join someone else's classroom timer by chance. Good
// enough for "control this specific link", not meant to resist a targeted
// attacker (there's nothing sensitive on the other end of it regardless).
function genSessionId(){
  return Math.random().toString(36).slice(2,8)+Date.now().toString(36).slice(-4);
}

/* ---------- final-10-seconds urgency ----------
   A running countdown gets a visible escalation once it's down to its last
   10 seconds — same signal red already used for "live", just intensified and
   pulsing, so it's an escalation of the one existing signal rather than a
   second colour. Toggled off on every reset path (stop/new timer/restart)
   and the instant a countdown actually hits zero, so it never keeps pulsing
   over a finished board. */
function setUrgent(on){
  const b=$("boardEl");
  if(b)b.classList.toggle("urgent-final",!!on);
}

function setState(s){
  state=s;
  setWakeLockActive(s==="running"||s==="finished");
  if(s!=="running")setUrgent(false);
  /* Settable when idle, sealed when live. Driven from here so the rule lives
     in exactly one place and can't drift: the moment a countdown starts, the
     board stops accepting input, and a viewer opening a shared link (which
     always boots straight into "running") never gets a control at all. */
  const bd=$("boardEl");
  if(bd){
    const canSet=(s==="ready"||s==="finished")&&formDirection==="down"&&
      direction!=="up"&&direction!=="interval"&&mode!=="days"&&!!$("tiles");
    bd.classList.toggle("settable",canSet);
    // Strip the input layer out of the DOM on the way into a live state —
    // hiding it in CSS would leave real <button>s inside a sealed board.
    if(!canSet&&$("tiles")&&$("tiles").querySelector(".field,.ghost")){
      $("tiles").querySelectorAll(".chev,.retract,#addHrsBtn").forEach(el=>el.remove());
      $("tiles").querySelectorAll(".field").forEach(el=>{
        el.removeAttribute("role");el.removeAttribute("tabindex");
        el.removeAttribute("aria-label");el.removeAttribute("aria-valuemin");
        el.removeAttribute("aria-valuemax");el.removeAttribute("aria-valuenow");
        el.removeAttribute("aria-valuetext");
      });
    }
    /* …and put it back on the way into one. This is what makes a FINISHED
       board settable: renderReady() builds the controls for "ready", but a
       countdown reaching zero lands here with plain tiles on screen, so
       without this the class said settable while the DOM had nothing to
       press. Seeds from the duration that just ran, so "again, but five
       minutes" is a roll away rather than a scroll away. */
    if(canSet&&$("tiles")&&!$("tiles").querySelector(".field")&&!$("tiles").querySelector(".tile-day")){
      const secs=boardTotal!=null?boardTotal:clampTotalSeconds(Math.round((total||0)/1000));
      if(secs>0){boardTypeBuf="";setBoardTotal(secs);}
    }
  }
  const show=(id,on)=>{const el=$(id);if(el)el.style.display=on?"":"none"};
  const live=s==="running"||s==="paused"; // "paused" is still a live, shareable session — see the state-list comment above
  show("boardStartBtn",!live);
  show("shareBtn",live);
  show("stopBtn",s!=="ready");
  show("syncDot",live);
  const dot=$("syncDot");if(dot)dot.classList.toggle("is-paused",s==="paused");
  const bs=$("boardStartBtn");
  /* "Restart — same duration" is only true when there IS a known duration to
     restart. Someone who opens a link that had already expired never had one
     (bootFromHash derives `total` from the time left at load, which is
     negative), so the restart falls back to this page's default length — and
     the button was promising to repeat a duration it couldn't know. Say what
     it will actually do instead. */
  const canRepeat = direction==="up" || direction==="interval" || total>0;
  if(bs)bs.textContent = s==="finished" ? (canRepeat?"Restart — same duration":"Start a new countdown")
    : (formDirection==="up" ? "Start counting up" : "Start countdown");
  const st=$("stopBtn");
  if(st)st.textContent = s==="finished" ? "New timer" : "Stop";
  const note=$("syncMsg");
  if(note)note.textContent = s==="paused"
    ? "Paused from the controller's phone — anyone with this link sees it frozen too."
    : s==="running"
    ? "Anyone opening your link right now sees exactly this."
    : "Press start, then share the link — every screen counts down together.";
}

function start(ms,lab){
  direction="down";
  end=Date.now()+ms;label=lab;fired=false;total=ms;prevValues=null;
  /* Tile layout (how many digit tiles are on screen) is fixed once, from the
     STARTING duration — not recomputed each tick. Otherwise an hour+ countdown
     would silently drop from 6 tiles to 4 the moment it crosses under 60
     minutes remaining, breaking the board mid-countdown. */
  mode = ms>=86400000?"days":ms>=3600000?"hms":"ms";
  // Opt-in only (see realtime-config.js) — a new session id every time
  // Start is pressed, never reused across separate countdowns.
  const wantsControl=$("phoneControlToggle")&&$("phoneControlToggle").checked;
  controlSession=(wantsControl&&window.CountlinkRealtime&&window.CountlinkRealtime.enabled)?genSessionId():null;
  pausedRemaining=0;
  location.hash=`t=${end}&l=${encodeURIComponent(label)}${controlSession?`&c=${controlSession}`:""}`;
  lastAnnouncedMin=null;announcedFinal=false;ivPhaseKey=null;
  announce(`Countdown started: ${Math.round(ms/60e3)} minutes${label?", "+label:""}`);
  saveRecent();
  setState("running");
  render();
  connectRealtimeIfNeeded();
  updateControlLinkUI();
}
function startUp(lab){
  direction="up";
  end=Date.now();label=lab;fired=false;total=0;prevValues=null;
  controlSession=null;pausedRemaining=0; // phone control is down-mode only
  mode="hms"; // always 6 tiles — an open-ended stopwatch can run past an hour, so never a 4-tile start
  location.hash=`t=${end}&l=${encodeURIComponent(label)}&d=up`;
  lastAnnouncedMin=null;announcedFinal=false;ivPhaseKey=null;
  announce("Stopwatch started"+(label?": "+label:""));
  saveRecent();
  setState("running");
  render();
}
/* Interval mode: `end` is the cycle START instant (like "up"), and every tick
   derives the current phase/round from elapsed time modulo (work+rest) —
   there's no per-round timestamp to track, so "resume from a shared link"
   and "resume after a tab was backgrounded" both just work, same as every
   other mode here. */
function startInterval(workSec,restSec,rounds,lab){
  direction="interval";
  end=Date.now();label=lab;fired=false;prevValues=null;
  controlSession=null;pausedRemaining=0; // phone control is down-mode only
  ivWork=Math.max(1,workSec);ivRest=Math.max(0,restSec);ivRounds=Math.max(1,rounds);
  mode="ms";
  location.hash=`t=${end}&l=${encodeURIComponent(label)}&d=iv&w=${ivWork}&r=${ivRest}&n=${ivRounds}`;
  lastAnnouncedMin=null;announcedFinal=false;ivPhaseKey=null;
  announce(`Interval timer started: ${ivRounds} rounds of ${ivWork}s work, ${ivRest}s rest`);
  saveRecent();
  setState("running");
  render();
}
/* Stop is honest about what it can do: with no server, there is no way to
   halt a countdown on screens that already have the link — the link IS the
   timer. Stopping resets THIS screen back to ready. If phone control was on,
   this also tells every other connected screen (and the controller) to stop
   too — the one exception to "stop only affects this screen", since it's an
   explicit broadcast rather than the passive link-timestamp mechanic. */
function stopTimer(){
  const hadControl=!!controlSession;
  clearInterval(tick);tick=null;end=null;fired=false;prevValues=null;lastSecond=null;ivPhaseKey=null;
  history.replaceState(null,"",location.pathname+location.search);
  document.body.classList.remove("viewing");
  renderReady(formMinutes(),$("evtName")?$("evtName").value:"");
  const heads=$("subLine");
  if(heads)heads.innerHTML="Stopped on this screen. A link you already shared keeps counting on other screens — the link itself is the timer.";
  if(hadControl)broadcastState("ready");
  disconnectRealtime();
  controlSession=null;pausedRemaining=0;
  updateControlLinkUI();
}

/* ---------- phone control: realtime wiring (see realtime.js, control.html) ----------
   Deliberately symmetric rather than "board is authoritative, viewers are
   passive": every tab open on the same controlled link — the classroom
   projector, a student's own device, doesn't matter which — applies an
   incoming command itself and rebroadcasts the result. Any of them
   converges the others; there's no special tab whose disconnection breaks
   the session. A periodic heartbeat state broadcast is what lets a
   late-arriving tab (or one that missed a message) catch up without needing
   Ably's paid history/rewind features. */
function renderPausedTiles(){
  clearInterval(tick);tick=null;
  $("evtLabel").textContent=label||"";
  const bar=document.querySelector(".bar");if(bar)bar.style.display="";
  const c=charsFor(pausedRemaining);
  if(c.plain)$("tiles").innerHTML=`<div class="tile-day">${c.plain}</div>`;
  else{
    if(!document.querySelector(".tile")||prevValues===null)buildTiles(c.tiles);
    else updateTiles(c.tiles);
  }
  prevValues=prevValues===null?true:prevValues;
  if(total>0)$("barFill").style.width=Math.max(0,Math.min(100,(1-pausedRemaining/total)*100))+"%";
  if($("shareUrl"))$("shareUrl").textContent=makeLink();
  const sub=$("subLine");
  if(sub)sub.innerHTML="<b>Paused</b> from the controller's phone — waiting to resume.";
}
function broadcastState(overrideState){
  if(!controlSession||!window.CountlinkRealtime)return;
  window.CountlinkRealtime.publishState(controlSession,{
    end:end,label:label,state:overrideState||state,pausedRemaining:pausedRemaining,
  });
}
/* The only thing that ever mutates the countdown in response to a command —
   pause/resume/adjust/stop all funnel through here, whether the command came
   from this device's own controller or arrived over the wire from another
   tab's. Guarded to down-mode/an active session; a stopwatch or interval
   timer with a stray `c` in its URL (shouldn't happen — start()/startUp()/
   startInterval() only ever set one in down-mode) just ignores commands. */
function applyRemoteCommand(cmd){
  if(direction!=="down"||!controlSession||!cmd)return;
  const now=Date.now();
  if(cmd.type==="pause"&&state==="running"){
    pausedRemaining=Math.max(0,end-now);
    setState("paused");
    renderPausedTiles();
    broadcastState();
  }else if(cmd.type==="resume"&&state==="paused"){
    end=computeResumeEnd(now,pausedRemaining);
    setState("running");
    render();
    broadcastState();
  }else if(cmd.type==="adjust"&&(state==="running"||state==="paused")){
    if(state==="paused"){pausedRemaining=clampAdjustedRemaining(pausedRemaining,cmd.deltaMs);renderPausedTiles();}
    else end=clampAdjustedEnd(end,now,cmd.deltaMs);
    broadcastState();
  }else if(cmd.type==="stop"&&state!=="ready"){
    stopTimer();
  }
}
/* A hard-sync from another tab's broadcast — used to catch this tab up
   (initial load, or one that missed a live command) rather than to drive
   its own state changes moment-to-moment; see connectRealtimeIfNeeded(). */
/* What an incoming state broadcast should make THIS screen do. Pure, so the
   one rule that matters here can be asserted directly (test/phone-control.test.mjs).

   That rule: only "ready" tears a screen down. "finished" deliberately does
   NOT. A finished countdown is a state every connected board reaches on its
   own, off the same shared deadline, at the same instant — it is a fact, not
   a command. Treating it as one meant that within a single 4s heartbeat of a
   controlled countdown hitting zero, the first board to broadcast "finished"
   made every other board call stopTimer(): wiping the "Time." board and its
   Restart button, replacing it with "Stopped on this screen", clearing the
   hash — and stopTimer()'s own broadcast then rippled back out. The classroom
   projector blanked itself seconds after the exam it was timing ended. */
function remoteStateAction(incoming,current){
  if(!incoming)return "none";
  if(incoming.state==="paused")return current==="paused"?"repaint-paused":"pause";
  if(incoming.state==="running")return current==="running"?"sync-end":"resume";
  if(incoming.state==="ready"&&current!=="ready")return "stop";
  return "none";
}
function applyRemoteState(s){
  if(direction!=="down"||!controlSession||!s)return;
  if(s.label!=null)label=s.label;
  const action=remoteStateAction(s,state);
  if(action==="pause"||action==="repaint-paused"){
    pausedRemaining=s.pausedRemaining||0;
    if(action==="pause")setState("paused");
    renderPausedTiles();
  }else if(action==="resume"||action==="sync-end"){
    if(s.end)end=s.end;
    if(action==="resume"){setState("running");render();}
  }else if(action==="stop"){
    stopTimer();
  }
}
function connectRealtimeIfNeeded(){
  disconnectRealtime();
  if(direction!=="down"||!controlSession||!window.CountlinkRealtime||!window.CountlinkRealtime.enabled)return;
  unsubRealtimeState=window.CountlinkRealtime.subscribeState(controlSession,applyRemoteState);
  unsubRealtimeCommands=window.CountlinkRealtime.subscribeCommands(controlSession,applyRemoteCommand);
  realtimeHeartbeat=setInterval(()=>broadcastState(),4000);
}
function disconnectRealtime(){
  if(unsubRealtimeState){unsubRealtimeState();unsubRealtimeState=null;}
  if(unsubRealtimeCommands){unsubRealtimeCommands();unsubRealtimeCommands=null;}
  if(realtimeHeartbeat){clearInterval(realtimeHeartbeat);realtimeHeartbeat=null;}
}
/* Setup-panel-only (see index.html): shows the "Copy control link" action
   next to the normal share link whenever this countdown actually has a
   phone-control session, and hides it otherwise — including on a page
   (like every /timers/* page) that doesn't have the checkbox/button at all,
   where every $() below is just null and this whole function no-ops. */
function updateControlLinkUI(){
  const wrap=$("controlLinkWrap");
  if(!wrap)return;
  wrap.style.display=controlSession?"":"none";
}
/* Ready state: show the preset duration as static tiles so the board is never
   an empty box, without pretending anything is running. msOverride is for
   date-target pages (countdown-to-a-date, where "minutes" isn't the input). */
function renderReady(min,lab,msOverride){
  clearInterval(tick);tick=null;
  label=lab;direction=formDirection;
  const ms=msOverride!=null?Math.max(1000,msOverride):Math.max(1,min)*60e3;
  // count-up always runs 6 tiles (see startUp), so preview it that way too
  mode = formDirection==="up"?"hms":ms>=86400000?"days":ms>=3600000?"hms":"ms";
  /* Deliberately no label on a ready board: page defaults are zero-moment
     phrases ("Time's up", "Bidding closed") that read as ALREADY finished
     when shown over a full, unstarted duration. Typing in the name field
     still live-previews it; the label always shows once running. */
  $("evtLabel").textContent="";
  const c=charsFor(formDirection==="up"?0:ms);
  /* Whether this particular ready board can be set on directly. Computed here
     rather than via boardIsSettable() because `state` is still whatever it was
     before setState("ready") runs at the bottom of this function. */
  const settable = formDirection==="down" && mode!=="days" && !c.plain && !!$("tiles");
  boardTotal = settable ? clampTotalSeconds(Math.round(ms/1000)) : null;
  boardTypeBuf="";
  if(c.plain)$("tiles").innerHTML=`<div class="tile-day">${c.plain}</div>`;
  else buildTiles(c.tiles,settable);
  prevValues=null;
  $("subLine").innerHTML=formDirection==="up"
    ? "A shared stopwatch — starts from zero when you press start."
    : settable
      ? `<b>${esc(spokenDuration(boardTotal))}</b> — set it right here, or press start to get a share link`
      : (msOverride!=null
        ? `counting to <b>${new Date(Date.now()+ms).toLocaleDateString([],{month:"short",day:"numeric"})}</b> — you'll get a share link the moment you start`
        : `<b>${min} minute${min===1?"":"s"}</b>, ready — you'll get a share link the moment you start`);
  $("barFill").style.width="0%";
  const bar=document.querySelector(".bar");if(bar)bar.style.display="";
  if($("shareUrl"))$("shareUrl").textContent="";
  setState("ready");
}

/* ================= settable board: the input layer =================
   Turns the ready board into the primary way to set a countdown. Everything
   here no-ops unless boardIsSettable() is true, and setState() rebuilds the
   tiles whenever that changes, so a running or shared board carries no
   controls in its DOM at all — not hidden ones, none. That matters more than
   it looks: the whole product promise is that everyone opening a link sees the
   identical countdown, so a viewer must have nothing to press. */
function boardIsSettable(){
  if(!$("tiles")||!$("boardEl"))return false;
  if(state!=="ready"&&state!=="finished")return false;
  // Only a plain countdown has a duration to roll. A stopwatch starts from
  // zero, an interval board is driven by its own work/rest fields, and a
  // days-mode board renders one plain string with no tiles to grab.
  if(formDirection!=="down")return false;
  if(direction==="up"||direction==="interval")return false;
  if(mode==="days")return false;
  return true;
}
function boardFieldEls(){return $("tiles")?[...$("tiles").querySelectorAll(".field")]:[];}
function currentBoardTotal(){
  if(boardTotal!=null)return boardTotal;
  const els=boardFieldEls();
  if(!els.length)return 0;
  const o={h:0,m:0,s:0};
  els.forEach(el=>{o[el.dataset.k]=+el.getAttribute("aria-valuenow")||0;});
  return totalFromFields(o);
}
/* Re-render the ready board at a new duration. Keeps the hours pair visible
   while the hours field has focus even once it hits zero — collapsing an
   element out from under someone's focus is how this kind of auto-layout
   turns hostile. */
function setBoardTotal(t,opts){
  /* opts.hours: true = force the hours pair on, false = force it off,
     undefined = decide automatically. The explicit form matters because the
     "keep hours while focused" rule below would otherwise defeat the "− Hrs"
     control: focus is still inside the hours field at the moment you press it,
     so an inferred decision keeps the field the user just asked to remove. */
  const forceHours=opts&&typeof opts.hours==="boolean"?opts.hours:null;
  boardTotal=clampTotalSeconds(t);
  const focusKey=document.activeElement&&document.activeElement.classList&&
    document.activeElement.classList.contains("field")?document.activeElement.dataset.k:null;
  const showHours=forceHours!=null?(forceHours||needsHours(boardTotal))
    :(needsHours(boardTotal)||focusKey==="h");
  mode=showHours?"hms":"ms";
  const f=fieldsFromTotal(boardTotal);
  const chars=showHours
    ?[{t:"tile",v:fmt2(f.h)[0]},{t:"tile",v:fmt2(f.h)[1]},{t:"sep",v:":"},
      {t:"tile",v:fmt2(f.m)[0]},{t:"tile",v:fmt2(f.m)[1]},{t:"sep",v:":"},
      {t:"tile",v:fmt2(f.s)[0]},{t:"tile",v:fmt2(f.s)[1]}]
    :[{t:"tile",v:fmt2(f.m)[0]},{t:"tile",v:fmt2(f.m)[1]},{t:"sep",v:":"},
      {t:"tile",v:fmt2(f.s)[0]},{t:"tile",v:fmt2(f.s)[1]}];
  const hadHours=boardFieldEls().some(el=>el.dataset.k==="h");
  if(hadHours!==showHours||!boardFieldEls().length){
    buildTiles(chars,true);
    if(focusKey){const el=$("tiles").querySelector('.field[data-k="'+focusKey+'"]');if(el)el.focus();}
  }else{
    updateTiles(chars);
  }
  syncBoardToForm();
  updateReadySubline();
  /* On a finished board the start button promises "Restart — same duration".
     The moment the digits are rolled to something else that promise is false,
     so the button has to stop making it. */
  if(state==="finished"){
    const bs=$("boardStartBtn");
    if(bs&&direction!=="up"&&direction!=="interval"){
      const same=total>0&&Math.abs(boardTotal-Math.round(total/1000))<1;
      bs.textContent=same?(total>0?"Restart — same duration":"Start a new countdown"):"Start countdown";
    }
  }
}
/* The board and the setup panel must never disagree about the duration, so
   every board edit writes back to #customMin and drops the "until a date"
   mode — exactly what clicking a quick-timer preset already does. */
function syncBoardToForm(){
  if(boardTotal==null)return;
  const el=$("customMin");
  if(el)el.value=String(Math.max(1,Math.round(boardTotal/60)));
  if($("untilTime"))$("untilTime").dataset.dirty="";
}
function spokenDuration(t){
  const f=fieldsFromTotal(t),p=[];
  if(f.h)p.push(f.h+(f.h===1?" hour":" hours"));
  if(f.m)p.push(f.m+(f.m===1?" minute":" minutes"));
  if(f.s)p.push(f.s+(f.s===1?" second":" seconds"));
  return p.length?p.join(" "):"nothing set";
}
function updateReadySubline(){
  if(state!=="ready"||!boardIsSettable()||boardTotal==null)return;
  $("subLine").innerHTML=`<b>${esc(spokenDuration(boardTotal))}</b> — set it right here, or press start to get a share link`;
}
function bumpBoardField(key,delta){
  if(!boardIsSettable())return;
  boardTypeBuf="";
  const unit=key==="h"?3600:key==="m"?60:1;
  setBoardTotal(bumpTotal(currentBoardTotal(),unit,delta),key==="h"?{hours:true}:undefined);
  const el=$("tiles").querySelector('.field[data-k="'+key+'"]');
  if(el&&document.activeElement!==el&&document.activeElement&&
     document.activeElement.classList&&!document.activeElement.classList.contains("chev"))el.focus();
  announce(spokenDuration(currentBoardTotal()));
}
function typeBoardDigit(d){
  if(!boardIsSettable())return;
  boardTypeBuf=(boardTypeBuf+d).slice(-6);
  setBoardTotal(parseKeypadDigits(boardTypeBuf));
  announce(spokenDuration(currentBoardTotal()));
}
function addBoardHours(){
  if(!boardIsSettable())return;
  boardTypeBuf="";
  setBoardTotal(currentBoardTotal(),{hours:true});
  const el=$("tiles").querySelector('.field[data-k="h"]');if(el)el.focus();
  announce("Hours added");
}
function dropBoardHours(){
  if(!boardIsSettable())return;
  boardTypeBuf="";
  const f=fieldsFromTotal(currentBoardTotal());
  setBoardTotal(f.m*60+f.s,{hours:false});
  const el=$("tiles").querySelector('.field[data-k="m"]');if(el)el.focus();
  announce("Hours removed");
}
/* Wired once, delegated from #tiles, and every handler guards on
   boardIsSettable() — so these stay attached and inert rather than being
   added and removed as the board changes state. */
(function wireSettableBoard(){
  const t=$("tiles");
  if(!t)return;
  t.addEventListener("click",e=>{
    if(!boardIsSettable())return;
    if(e.target.closest(".retract")){e.preventDefault();dropBoardHours();return;}
    if(e.target.closest("#addHrsBtn")){e.preventDefault();addBoardHours();return;}
    const chev=e.target.closest(".chev");
    if(chev){
      e.preventDefault();
      bumpBoardField(chev.closest(".field").dataset.k,chev.classList.contains("up")?1:-1);
      return;
    }
    const fld=e.target.closest(".field");
    if(fld)fld.focus();
  });
  t.addEventListener("keydown",e=>{
    if(!boardIsSettable())return;
    const fld=e.target.closest(".field");
    if(!fld)return;
    const k=fld.dataset.k,step=e.shiftKey?10:1;
    if(e.key==="ArrowUp"){e.preventDefault();bumpBoardField(k,step);}
    else if(e.key==="ArrowDown"){e.preventDefault();bumpBoardField(k,-step);}
    else if(e.key==="ArrowRight"||e.key==="ArrowLeft"){
      e.preventDefault();
      const order=boardFieldEls().map(el=>el.dataset.k);
      const i=order.indexOf(k)+(e.key==="ArrowRight"?1:-1);
      if(i>=0&&i<order.length){
        const next=$("tiles").querySelector('.field[data-k="'+order[i]+'"]');if(next)next.focus();
      }else if(i<0){
        const g=$("addHrsBtn");if(g)g.focus();
      }
    }
    else if(/^\d$/.test(e.key)){e.preventDefault();typeBoardDigit(e.key);}
    else if(e.key==="Backspace"){
      e.preventDefault();
      boardTypeBuf=boardTypeBuf.slice(0,-1);
      setBoardTotal(parseKeypadDigits(boardTypeBuf||"0"));
    }
    else if(e.key==="Escape"){
      e.preventDefault();boardTypeBuf="";
      renderReady(formMinutes(),$("evtName")?$("evtName").value:"");
    }
    else if(e.key==="Enter"){e.preventDefault();boardTypeBuf="";startFromForm();}
    else if(e.key==="Home"){e.preventDefault();bumpBoardField(k,-99);}
  });
  t.addEventListener("wheel",e=>{
    if(!boardIsSettable())return;
    const fld=e.target.closest(".field");
    if(!fld)return;
    e.preventDefault();
    bumpBoardField(fld.dataset.k,e.deltaY<0?1:-1);
  },{passive:false});
  t.addEventListener("paste",e=>{
    if(!boardIsSettable())return;
    if(!e.target.closest(".field"))return;
    e.preventDefault();
    const txt=(e.clipboardData||window.clipboardData).getData("text");
    const parsed=parsePastedDuration(txt);
    if(parsed==null){announce("Couldn't read that as a duration");return;}
    boardTypeBuf="";setBoardTotal(parsed);
    announce(spokenDuration(parsed));
  });
  /* Touch: drag a field vertically to roll it — the gesture the physical
     metaphor implies. Mouse is excluded so it can't fight text selection or
     the chevrons. */
  let dragKey=null,dragY=0,dragAcc=0;
  t.addEventListener("pointerdown",e=>{
    if(!boardIsSettable()||e.pointerType==="mouse")return;
    const fld=e.target.closest(".field");
    if(!fld||e.target.closest(".chev")||e.target.closest(".retract"))return;
    /* Only a field that's already been tapped takes over the vertical axis —
       see the touch-action rule in style.css. Without this, the first swipe
       over a board that fills half the phone screen rolls digits instead of
       scrolling the page. */
    if(!fld.contains(document.activeElement)&&document.activeElement!==fld)return;
    dragKey=fld.dataset.k;dragY=e.clientY;dragAcc=0;
  });
  window.addEventListener("pointermove",e=>{
    if(!dragKey)return;
    dragAcc+=(dragY-e.clientY);dragY=e.clientY;
    while(Math.abs(dragAcc)>=18){
      bumpBoardField(dragKey,dragAcc>0?1:-1);
      dragAcc+=dragAcc>0?-18:18;
    }
  },{passive:true});
  window.addEventListener("pointerup",()=>{dragKey=null;});
  window.addEventListener("pointercancel",()=>{dragKey=null;});
  /* Once focus leaves a zeroed hours field, let it retract. */
  t.addEventListener("focusout",e=>{
    if(!boardIsSettable())return;
    const fld=e.target.closest(".field");
    if(!fld||fld.dataset.k!=="h")return;
    setTimeout(()=>{
      if(!boardIsSettable())return;
      const still=$("tiles")&&$("tiles").contains(document.activeElement);
      if(!still&&!needsHours(currentBoardTotal()))setBoardTotal(currentBoardTotal(),{hours:false});
    },0);
  });
})();

/* ---------- sound: a soft mechanical tick each second, plus a triple chime at zero ---------- */
function ctx(){
  if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();
  return audioCtx;
}
function tick_sound(){
  if(!sound)return;
  const c=ctx(),dur=.05;
  const buf=c.createBuffer(1,c.sampleRate*dur,c.sampleRate);
  const data=buf.getChannelData(0);
  for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);
  const src=c.createBufferSource();src.buffer=buf;
  const bp=c.createBiquadFilter();bp.type="bandpass";bp.frequency.value=1800;bp.Q.value=1.1;
  const g=c.createGain();g.gain.setValueAtTime(.16,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+dur);
  src.connect(bp).connect(g).connect(c.destination);src.start();
}
/* A few distinct alarm tones, all synthesized (no audio files to fetch) —
   picking one is purely a per-viewer local preference (like board style),
   never part of the shared sync link. */
// A `function` (not `const`), purely so it can be exported to the test
// runner below the early module.exports return point (function declarations
// hoist their full body; a `const` object here would still be in its
// temporal dead zone at that point, since the code that initializes it never
// actually runs under the test harness's early return).
function alarmTones(){return{
  chime:c=>[0,.28,.56].forEach((t,i)=>{
    const o=c.createOscillator(),g=c.createGain();
    o.frequency.value=i===2?1318:880;o.type="sine";
    g.gain.setValueAtTime(.32,c.currentTime+t);
    g.gain.exponentialRampToValueAtTime(.001,c.currentTime+t+.24);
    o.connect(g).connect(c.destination);o.start(c.currentTime+t);o.stop(c.currentTime+t+.25);
  }),
  gentle:c=>{
    const o=c.createOscillator(),g=c.createGain();
    o.frequency.value=660;o.type="sine";
    g.gain.setValueAtTime(0,c.currentTime);
    g.gain.linearRampToValueAtTime(.22,c.currentTime+.15);
    g.gain.exponentialRampToValueAtTime(.001,c.currentTime+1.1);
    o.connect(g).connect(c.destination);o.start();o.stop(c.currentTime+1.15);
  },
  digital:c=>[0,.14,.28].forEach(t=>{
    const o=c.createOscillator(),g=c.createGain();
    o.frequency.value=988;o.type="square";
    g.gain.setValueAtTime(.14,c.currentTime+t);
    g.gain.exponentialRampToValueAtTime(.001,c.currentTime+t+.1);
    o.connect(g).connect(c.destination);o.start(c.currentTime+t);o.stop(c.currentTime+t+.11);
  }),
  bell:c=>{
    [880,1760,2640].forEach((f,i)=>{
      const o=c.createOscillator(),g=c.createGain();
      o.frequency.value=f;o.type="sine";
      g.gain.setValueAtTime(i===0?.3:.09,c.currentTime);
      g.gain.exponentialRampToValueAtTime(.001,c.currentTime+1.4);
      o.connect(g).connect(c.destination);o.start();o.stop(c.currentTime+1.4);
    });
  },
};}
function beep(){
  if(!sound)return;
  const tones=alarmTones();
  (tones[alarmTone]||tones.chime)(ctx());
}

/* ---------- keep the screen awake while a timer is actually showing ----------
   A projected exam/workshop/webinar timer that lets the screen dim mid-count
   defeats the whole point. Silent, automatic, no toggle: there's no case
   where a viewer wants their screen to sleep while a countdown they opened is
   the thing on screen, and it degrades to a no-op on any browser without the
   Wake Lock API (Safari < 16.4, most non-Chromium mobile browsers) — the
   timer works exactly the same either way, just without this extra. */
let wakeLock=null,wakeLockActive=false,wakeLockAcquiring=false;
async function acquireWakeLock(){
  if(!("wakeLock" in navigator)||wakeLockAcquiring)return;
  wakeLockAcquiring=true;
  try{
    wakeLock=await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release",()=>{wakeLock=null;});
  }catch(e){/* denied (e.g. low battery mode) or not in a secure context — fail silently */}
  wakeLockAcquiring=false;
}
function releaseWakeLock(){
  if(wakeLock){wakeLock.release().catch(()=>{});wakeLock=null;}
}
// Pure decision extracted from setWakeLockActive() so the exact guard logic
// (the bug-prone part — get this wrong and it either spams navigator.wakeLock
// or never re-acquires after a failed first attempt) is directly testable
// without any browser API.
function shouldSkipWakeLockChange(on,active,held,acquiring){
  return on===active&&(on?(held||acquiring):true);
}
function setWakeLockActive(on){
  // Some start paths call this twice in the same tick (setting location.hash
  // fires a same-tab hashchange that re-derives state) — the acquiring/held
  // checks make every call after the first a safe no-op either way.
  if(shouldSkipWakeLockChange(on,wakeLockActive,!!wakeLock,wakeLockAcquiring))return;
  wakeLockActive=on;
  if(on)acquireWakeLock();else releaseWakeLock();
}
// The spec releases the lock whenever the tab is hidden (switching apps,
// locking a phone) and never re-acquires it automatically — so re-request it
// on return if a timer is still meant to be keeping the screen on.
document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible"&&wakeLockActive&&!wakeLock)acquireWakeLock();
});

/* ---------- split-flap tile rendering ----------
   Tiles are grouped into FIELDS (hh / mm / ss) rather than laid out flat, so a
   settable board has one control per unit instead of one per digit. Six
   separate per-digit spinbuttons would read as "0, spin button" six times to a
   screen reader, and per-digit wheels can't carry — see the duration-model
   block above. The flat, non-settable path renders the same tiles inside the
   same wrappers, so updateTiles()/charsFor() and all three board styles are
   untouched either way. */
function tileFields(chars){
  const groups=[];let cur=[];
  chars.forEach(c=>{
    if(c.t==="sep"){if(cur.length){groups.push(cur);cur=[];}return;}
    cur.push(c);
  });
  if(cur.length)groups.push(cur);
  const keys=groups.length===3?["h","m","s"]:groups.length===2?["m","s"]:null;
  return keys?groups.map((g,i)=>({key:keys[i],chars:g})):null;
}
const FIELD_LABEL={h:"Hours",m:"Minutes",s:"Seconds"};
function makeTileEl(v){
  const tile=document.createElement("div");
  tile.className="tile";
  tile.setAttribute("aria-hidden","true"); // decoration; the field carries the value
  tile.innerHTML=`
      <div class="flap"><span class="num">${v}</span></div>
      <div class="half top"><span class="num">${v}</span></div>
      <div class="half bottom"><span class="num">${v}</span></div>`;
  return tile;
}
function makeChev(dir,key){
  const b=document.createElement("button");
  b.type="button";b.className="chev "+dir;b.tabIndex=-1;
  b.setAttribute("aria-label",(dir==="up"?"Increase ":"Decrease ")+FIELD_LABEL[key].toLowerCase());
  b.innerHTML=dir==="up"
    ? '<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M6 2 L11 9 L1 9 Z" fill="currentColor"/></svg>'
    : '<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M6 10 L1 3 L11 3 Z" fill="currentColor"/></svg>';
  return b;
}
function buildTiles(chars,settable){
  // chars: array of {t:"tile"|"sep", v:string}
  const board=$("tiles");
  board.innerHTML="";
  const fields=tileFields(chars);
  if(!settable||!fields){
    // Plain readout — exactly the markup this function always produced.
    chars.forEach(c=>{
      if(c.t==="sep"){
        const s=document.createElement("div");
        s.className="tile-sep";s.textContent=c.v;
        board.appendChild(s);
        return;
      }
      board.appendChild(makeTileEl(c.v));
    });
    return;
  }
  /* "+hr" ghost: sits exactly where the hours pair will appear, so the control
     is in the place the result shows up. Deliberately slim — a full-size
     placeholder competes with the digits on a board most visitors only read. */
  if(fields.length===2){
    const g=document.createElement("button");
    g.type="button";g.className="ghost";g.id="addHrsBtn";
    g.title="Add hours";
    g.setAttribute("aria-label","Add hours to this timer");
    g.innerHTML='<span class="stack"><span class="plus">+</span><span>hr</span></span>';
    board.appendChild(g);
  }
  fields.forEach((f,i)=>{
    if(i){
      const s=document.createElement("div");
      s.className="tile-sep";s.textContent=":";
      board.appendChild(s);
    }
    const wrap=document.createElement("div");
    wrap.className="field";wrap.dataset.k=f.key;
    wrap.setAttribute("role","spinbutton");
    wrap.setAttribute("tabindex","0");
    wrap.setAttribute("aria-label",FIELD_LABEL[f.key]);
    wrap.setAttribute("aria-valuemin","0");
    wrap.setAttribute("aria-valuemax",f.key==="h"?"99":"59");
    const val=+f.chars.map(c=>c.v).join("");
    wrap.setAttribute("aria-valuenow",String(val));
    wrap.setAttribute("aria-valuetext",val+" "+FIELD_LABEL[f.key].toLowerCase());
    f.chars.forEach(c=>wrap.appendChild(makeTileEl(c.v)));
    wrap.appendChild(makeChev("up",f.key));
    wrap.appendChild(makeChev("down",f.key));
    /* A zeroed hours pair swaps its own down-chevron for a remove control:
       rolling below zero and "drop this unit" are the same intent, so they
       share one slot rather than adding more chrome to the board. */
    if(f.key==="h"){
      wrap.classList.toggle("can-retract",val===0);
      const rt=document.createElement("button");
      rt.type="button";rt.className="retract";rt.tabIndex=-1;
      rt.setAttribute("aria-label","Remove hours");
      rt.textContent="− Hrs";
      wrap.appendChild(rt);
    }
    board.appendChild(wrap);
  });
}
function updateTiles(chars){
  const board=$("tiles");
  const tileEls=[...board.querySelectorAll(".tile")];
  let ti=0;
  /* Keep the spinbutton values in step with the flaps. Without this a screen
     reader would keep reading the value the board was built with, however many
     times the user had rolled it since. */
  const fieldEls=[...board.querySelectorAll(".field")];
  if(fieldEls.length){
    const groups=tileFields(chars);
    if(groups&&groups.length===fieldEls.length){
      groups.forEach((g,i)=>{
        const el=fieldEls[i],v=+g.chars.map(c=>c.v).join("");
        el.setAttribute("aria-valuenow",String(v));
        el.setAttribute("aria-valuetext",v+" "+FIELD_LABEL[el.dataset.k].toLowerCase());
        if(el.dataset.k==="h")el.classList.toggle("can-retract",v===0);
      });
    }
  }
  chars.forEach(c=>{
    if(c.t==="sep")return;
    const el=tileEls[ti++];
    if(!el)return;
    const cur=el.querySelector(".half.top .num").textContent;
    if(cur===c.v)return;
    const flap=el.querySelector(".flap");
    flap.querySelector(".num").textContent=cur;      // flap shows the OLD value as it folds away
    el.querySelector(".half.top .num").textContent=c.v;    // new value already waiting underneath
    el.querySelector(".half.bottom .num").textContent=c.v;
    flap.classList.remove("flipping");void flap.offsetWidth;flap.classList.add("flipping");
    flap.addEventListener("animationend",()=>{
      flap.classList.remove("flipping");
      flap.querySelector(".num").textContent=c.v;
    },{once:true});
  });
}

function charsFor(left,modeOverride){
  // Branches on the FIXED mode decided at start() — never on live h/m/s —
  // so the tile count never changes mid-countdown (see start()).
  // modeOverride lets tests exercise all three branches without needing a
  // live start()/bootFromHash() call to set the closure `mode` first; every
  // real call site omits it and gets the normal closure-driven behavior.
  const effMode=modeOverride===undefined?mode:modeOverride;
  const s=Math.max(0,Math.floor(left/1000));
  if(effMode==="days"){
    const days=Math.floor(s/86400),h=Math.floor(s%86400/3600);
    return {plain:`${days}d ${fmt2(h)}:${fmt2(Math.floor(s%3600/60))}:${fmt2(s%60)}`};
  }
  if(effMode==="hms"){
    const h=Math.floor(s/3600),m=Math.floor(s%3600/60),sec=s%60;
    /* A 2-tile hours field can't show 100+. fmt2(100) is "100", and taking
       hh[0]/hh[1] off it silently rendered "10" — a stopwatch left running
       over a long weekend read 10:xx:xx and looked plausible while being
       four days wrong. Countdowns can't reach this (>=24h picks "days"), but
       count-up has no upper bound, so overflow falls back to the same plain
       "Nd HH:MM:SS" readout the days mode uses rather than lying in two
       digits. */
    if(h>99)return {plain:`${Math.floor(s/86400)}d ${fmt2(Math.floor(s%86400/3600))}:${fmt2(m)}:${fmt2(sec)}`};
    const hh=fmt2(h),mm=fmt2(m),ss=fmt2(sec);
    return {tiles:[
      {t:"tile",v:hh[0]},{t:"tile",v:hh[1]},{t:"sep",v:":"},
      {t:"tile",v:mm[0]},{t:"tile",v:mm[1]},{t:"sep",v:":"},
      {t:"tile",v:ss[0]},{t:"tile",v:ss[1]},
    ]};
  }
  const m=Math.floor(s/60),sec=s%60;
  const mm=fmt2(m),ss=fmt2(sec);
  return {tiles:[
    {t:"tile",v:mm[0]},{t:"tile",v:mm[1]},{t:"sep",v:":"},
    {t:"tile",v:ss[0]},{t:"tile",v:ss[1]},
  ]};
}

/* ================= settable board: the duration model =================
   The ready board is an INPUT, not just a readout — you set the countdown on
   the flaps themselves (see setSettable/buildTiles below). Everything here is
   pure so it can be unit-tested without a browser; the DOM layer further down
   only ever calls into these.

   The board holds ONE duration, as total seconds, and every edit is arithmetic
   on that total. That is the whole design decision: treating the three fields
   as independent digit wheels — the obvious first cut — means rolling seconds
   up from 59 wraps to 00 and *reduces* the countdown by 59 seconds, which is
   indefensible on a timer. Holding a single total gives carry and borrow for
   free (59:59 + 1s = 1:00:00, 0:00 - 1s stays 0) and lets the hours pair grow
   and retract on its own, so there is no "mode" for anyone to manage. */
/* 99:59:59 — the most six tiles can show. A `function` rather than a `const`
   for the same temporal-dead-zone reason as alarmTones() above: the test
   harness returns at the module.exports block near the top of this file, so
   the rest of the file never executes and any `const` declared down here would
   still be uninitialized when an exported function tried to read it. Function
   declarations hoist their full body, so this is always callable. */
function maxSettable(){return 99*3600+59*60+59;}
function clampTotalSeconds(t){
  t=Math.floor(Number(t));
  if(!isFinite(t))return 0;
  return Math.max(0,Math.min(maxSettable(),t));
}
function fieldsFromTotal(t){
  t=clampTotalSeconds(t);
  return {h:Math.floor(t/3600),m:Math.floor(t%3600/60),s:t%60};
}
function totalFromFields(o){
  return clampTotalSeconds((o&&o.h||0)*3600+(o&&o.m||0)*60+(o&&o.s||0));
}
/* Hours are shown whenever the duration needs them, and only then — matching
   the same >=1h threshold start() already uses to pick "hms" over "ms", so a
   board set to 1:00:00 and a board started at 1:00:00 have identical layout. */
function needsHours(totalSeconds){return clampTotalSeconds(totalSeconds)>=3600;}
/* Keypad entry fills from the right, then NORMALISES: "9000" means 90 minutes,
   which is a legal thing to type and an illegal thing to display, so it lands
   as 1:30:00 rather than erroring. Microwaves and phone timers both behave
   this way, so it needs no teaching. */
function parseKeypadDigits(buf){
  const d=String(buf==null?"":buf).replace(/\D/g,"").slice(-6).padStart(6,"0");
  return clampTotalSeconds(+d.slice(0,2)*3600 + +d.slice(2,4)*60 + +d.slice(4,6));
}
function bumpTotal(total,unitSeconds,delta){
  return clampTotalSeconds(clampTotalSeconds(total)+unitSeconds*Math.trunc(delta));
}
/* Pasting a duration. Accepts what people actually have on their clipboard:
   "1:30:00", "5:00", "90m", "1h30m", or a bare number read as minutes (the
   overwhelmingly common case — "45" from a calendar invite means 45 minutes,
   never 45 seconds). Returns null for anything unparseable so the caller can
   say so rather than silently setting a wrong time. */
function parsePastedDuration(txt){
  const t=String(txt==null?"":txt).trim().toLowerCase();
  if(!t)return null;
  const colon=t.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if(colon){
    return colon[3]!==undefined
      ? clampTotalSeconds(+colon[1]*3600 + +colon[2]*60 + +colon[3])
      : clampTotalSeconds(+colon[1]*60 + +colon[2]);
  }
  const units=t.match(/^(?:(\d{1,3})\s*h)?\s*(?:(\d{1,3})\s*m(?!s))?\s*(?:(\d{1,3})\s*s)?$/);
  if(units&&(units[1]||units[2]||units[3])){
    return clampTotalSeconds((+units[1]||0)*3600+(+units[2]||0)*60+(+units[3]||0));
  }
  if(/^\d{1,3}$/.test(t))return clampTotalSeconds(+t*60);
  return null;
}

/* ---------- screen-reader announcements ----------
   The flip tiles are aria-hidden (per-digit divs read as noise); instead a
   polite live region announces at sensible moments only — start, each whole
   minute, the final 10 seconds once, and zero. Announcing every second would
   make the page unusable with a screen reader. */
let lastAnnouncedMin=null,announcedFinal=false;
function announce(msg){const el=$("a11yStatus");if(el)el.textContent=msg;}
function announceLeft(left){
  const s=Math.max(0,Math.ceil(left/1000)),m=Math.floor(s/60);
  if(s===0){if(lastAnnouncedMin!==-1){announce((label?label+" — ":"")+"time is up");lastAnnouncedMin=-1;}return;}
  if(s<=10&&!announcedFinal){announce("10 seconds remaining");announcedFinal=true;return;}
  if(s%60===0&&m!==lastAnnouncedMin&&m>0){announce(`${m} minute${m===1?"":"s"} remaining`);lastAnnouncedMin=m;}
}

function render(){clearInterval(tick);tick=setInterval(draw,250);draw();}

let lastSecond=null;
function draw(){
  if(!end)return;
  $("evtLabel").textContent=label||"";

  if(direction==="up"){
    document.querySelector(".bar").style.display="none"; // no fixed total for an open-ended stopwatch, so no progress line
    const elapsed=Date.now()-end;
    const c=charsFor(elapsed);
    const curSecond=Math.floor(elapsed/1000);
    /* Past 100 hours charsFor() hands back a plain string instead of tiles
       (see its own comment) — the down branch below has always handled that
       shape, this one didn't, and buildTiles(undefined) would have thrown on
       every frame from that point on. */
    if(c.plain){
      $("tiles").innerHTML=`<div class="tile-day">${c.plain}</div>`;
      prevValues=null;
    }else if(!document.querySelector(".tile")||prevValues===null){buildTiles(c.tiles);prevValues=true;}
    else updateTiles(c.tiles);
    if(lastSecond!==null&&curSecond!==lastSecond)tick_sound();
    lastSecond=curSecond;
    $("subLine").innerHTML=`started at <b>${new Date(end).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</b> — synced on every screen with this link`;
    $("shareUrl").textContent=makeLink();
    return;
  }

  if(direction==="interval"){
    const cycleSec=ivWork+ivRest;
    const elapsedMs=Date.now()-end;
    const totalMs=cycleSec*1000*ivRounds;
    const ivPhaseEl=$("ivPhase");
    if(elapsedMs>=totalMs){
      const chars=charsFor(0,"ms").tiles;
      if(!document.querySelector(".tile"))buildTiles(chars);else updateTiles(chars);
      if(ivPhaseEl)ivPhaseEl.textContent=`Done — ${ivRounds} of ${ivRounds} rounds complete`;
      // Overrides the plain label set at the top of draw() — the board's
      // most prominent text slot is the natural place for phase/round
      // status, not the setup panel someone has likely scrolled away from.
      $("evtLabel").textContent=`Done — ${ivRounds} of ${ivRounds} rounds`+(label?" · "+label:"");
      $("subLine").innerHTML="<b>All rounds complete.</b> This screen — and every screen with your link — just finished together.";
      $("barFill").style.width="100%";
      if(!fired){
        fired=true;beep();
        /* Nothing left to draw — stop the 250ms loop before flipping state.
           It used to keep running over a finished board, which was harmless
           while the board was a readout and is not now: it repainted 00:00
           over any duration rolled onto the settable finished board within a
           quarter of a second. */
        clearInterval(tick);tick=null;
        setState("finished");announceLeft(0);
      }
      return;
    }
    document.querySelector(".bar").style.display="";
    const {round,inWork,phaseLeftMs,phaseTotalMs,urgent}=intervalPhase(ivWork,ivRest,ivRounds,elapsedMs);
    const c=charsFor(phaseLeftMs,"ms");
    const curSecond=Math.floor(phaseLeftMs/1000);
    if(!document.querySelector(".tile")||prevValues===null){buildTiles(c.tiles);prevValues=true;}
    else updateTiles(c.tiles);
    if(lastSecond!==null&&curSecond!==lastSecond)tick_sound();
    lastSecond=curSecond;
    /* A round-transition cue. An interval timer is the one mode nobody is
       looking at — you're mid-burpee, the screen is across the room — and it
       had no audible marker at all between rounds, only a single chime after
       the very last one. The per-second tick is identical in work and rest,
       so by ear the whole session was one undifferentiated noise. Fires on
       every work→rest→work boundary, not on the first frame (no phantom beep
       when a late viewer opens the link mid-round) and not on the final
       boundary into "done", which has its own chime below. */
    const phaseKey=round+(inWork?"w":"r");
    if(ivPhaseKey!==null&&ivPhaseKey!==phaseKey){beep();announcedFinal=false;lastAnnouncedMin=null;}
    ivPhaseKey=phaseKey;
    setUrgent(urgent);
    if(ivPhaseEl)ivPhaseEl.textContent=`${inWork?"WORK":"REST"} — round ${round} of ${ivRounds}`;
    $("evtLabel").textContent=`${inWork?"WORK":"REST"} — round ${round} of ${ivRounds}`+(label?" · "+label:"");
    announceLeft(phaseLeftMs);
    $("subLine").innerHTML=`round <b>${round} of ${ivRounds}</b> — synced on every screen with this link`;
    /* Progress across THIS phase, so work and rest each fill 0→100%.
       It used to divide the rest phase's remaining time by the whole cycle
       length, which made the bar snap backwards to ~67% (for the default
       20/10) at each work→rest boundary and crawl from there — reading as a
       glitch rather than as progress. */
    $("barFill").style.width=Math.max(0,Math.min(100,(1-phaseLeftMs/phaseTotalMs)*100))+"%";
    $("shareUrl").textContent=makeLink();
    return;
  }

  document.querySelector(".bar").style.display="";

  const left=end-Date.now();
  if(left<=0){
    if(mode==="days"||!document.querySelector(".tile")){
      $("tiles").innerHTML=`<div class="tile-day">00:00:00</div>`;
    }else{
      const chars=charsFor(0).tiles;
      if(!document.querySelector(".tile"))buildTiles(chars);else updateTiles(chars);
    }
    $("subLine").innerHTML="<b>Time.</b> This screen — and every screen with your link — just hit zero together.";
    $("barFill").style.width="100%";
    if(!fired){
      fired=true;beep();
      // See the interval branch above: the loop must stop before the board
      // becomes settable again, or it repaints zero over the user's input.
      clearInterval(tick);tick=null;
      setState("finished");announceLeft(0);
    }
    return;
  }
  const c=charsFor(left);
  const curSecond=Math.floor(left/1000);
  if(c.plain){
    $("tiles").innerHTML=`<div class="tile-day">${c.plain}</div>`;
  }else{
    if(!document.querySelector(".tile")||prevValues===null){buildTiles(c.tiles);prevValues=true;}
    else updateTiles(c.tiles);
    if(lastSecond!==null&&curSecond!==lastSecond)tick_sound();
  }
  lastSecond=curSecond;
  setUrgent(left<=10000);
  announceLeft(left);
  $("subLine").innerHTML=`ends at <b>${new Date(end).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</b> — synced on every screen with this link`;
  if(total>0)$("barFill").style.width=Math.max(0,Math.min(100,(1-left/total)*100))+"%";
  $("shareUrl").textContent=makeLink();
}

/* ---------- recent timers: a per-browser localStorage list, never synced ----------
   Solves "I have several timers on the go" / "I lost the link I shared
   yesterday" without cluttering the board with a multi-timer UI — each link
   IS a timer, so a list of links is a list of timers. */
const RECENT_KEY="countlink_recent";
function saveRecent(){
  try{
    const u=makeLink();
    let list=JSON.parse(localStorage.getItem(RECENT_KEY)||"[]");
    list=list.filter(r=>r.u!==u);
    list.unshift({u,l:label,e:end,d:direction});
    localStorage.setItem(RECENT_KEY,JSON.stringify(list.slice(0,6)));
  }catch(e){}
  renderRecent();
}
function renderRecent(){
  const wrap=$("recentWrap"),listEl=$("recentList");
  if(!wrap||!listEl)return;
  let list=[];
  try{list=JSON.parse(localStorage.getItem(RECENT_KEY)||"[]")}catch(e){}
  if(!list.length){wrap.style.display="none";return;}
  wrap.style.display="";
  listEl.innerHTML=list.map(r=>{
    const t=new Date(r.e).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
    const status=r.d==="up"?`stopwatch · started ${t}`
      :(r.e<=Date.now()?`finished at ${t}`:`running · ends ${t}`);
    // The label was already escaped; the URL was not, and it goes into an
    // attribute — where a bare " ends the attribute and everything after it
    // is parsed as markup. These URLs are self-produced by makeLink() and
    // browsers percent-encode quotes in a real location, so this isn't a
    // live hole; it's one character of storage-shaped input away from being
    // one, and the escape costs nothing.
    return `<a class="recent-item" href="${esc(r.u)}"><span class="rl">${esc(r.l||"Untitled timer")}</span><span class="rs">${status}</span></a>`;
  }).join("");
}
if($("recentClear"))$("recentClear").addEventListener("click",()=>{
  try{localStorage.removeItem(RECENT_KEY)}catch(e){}
  renderRecent();
});

/* Quick timer buttons: set the custom minutes value and preview it on the
   ready board — the countdown only starts when the user says so. */
document.querySelectorAll(".q[data-min]").forEach(b=>b.addEventListener("click",()=>{
  $("customMin").value=b.dataset.min;
  $("untilTime").dataset.dirty=""; // clear the "until time" mode so start button uses customMin
  if(state!=="running")renderReady(+b.dataset.min,$("evtName").value);
}));

/* countdown vs count-up: a form choice, not a URL-shareable setting in itself —
   once started, the direction travels with the link via makeLink()/readHash(). */
let formDirection="down";
document.querySelectorAll(".dir-toggle .q").forEach(b=>b.addEventListener("click",()=>{
  formDirection=b.dataset.dir;
  document.querySelectorAll(".dir-toggle .q").forEach(x=>{x.classList.toggle("active",x===b);x.setAttribute("aria-pressed",x===b);});
  const isUp=formDirection==="up";
  if($("durationFields"))$("durationFields").style.display=isUp?"none":"block";
  if($("countUpHint"))$("countUpHint").style.display=isUp?"block":"none";
  $("startBtn").textContent=isUp?"Start counting up":"Start countdown";
  if(state!=="running")renderReady(formMinutes(),$("evtName").value);
}));

function startFromForm(){
  if(formDirection==="up"){startUp($("evtName").value);return;}
  const dirty=$("untilTime").dataset.dirty;
  if(dirty){start(new Date($("untilTime").value)-Date.now(),$("evtName").value);return;}
  /* A board that's been set on wins over #customMin — that's the whole point
     of setting it there. It also carries SECONDS, which the minutes-only form
     field can't express, so reading the form here would quietly round 7:30
     down to 7:00. Falls back to the form whenever the board isn't settable
     (count-up, interval, days-mode boards). */
  if(boardTotal!=null&&boardTotal>0){start(boardTotal*1000,$("evtName").value);return;}
  start(formMinutes()*60e3,$("evtName").value);
}
if($("startBtn"))$("startBtn").addEventListener("click",()=>{
  startFromForm();
  // the form sits below the board — bring the now-running board back on screen
  $("boardEl").scrollIntoView({behavior:"smooth",block:"nearest"});
});
if($("boardStartBtn"))$("boardStartBtn").addEventListener("click",()=>{
  if(state==="finished"){
    // Restart: same duration/label as the countdown that just ended (fresh link)
    if(direction==="up")startUp(label);
    else if(direction==="interval")startInterval(ivWork,ivRest,ivRounds,label);
    /* A finished board is settable again, so if it's been rolled to a new
       duration that's what "start" must mean — restarting the old length
       after the user has visibly changed the digits would be the board
       lying about itself. boardTotal is seeded from `total` when the
       countdown ends, so an untouched board still restarts identically. */
    else if(boardTotal!=null&&boardTotal>0)start(boardTotal*1000,label);
    else if(total>0)start(total,label);
    // A recipient who opened the link after it already expired never had a
    // positive `total` to begin with — there's no way to recover the
    // original duration with no server, so this page's own default length
    // is the honest fallback. But `label` (synced from the actual link via
    // readHash()) is always correct — startFromForm() reads the evtName
    // FORM FIELD instead, which a recipient's page never syncs to the link's
    // real label, so it silently restarted under the page's stale default
    // text rather than the timer that just finished.
    else start(formMinutes()*60e3,label);
    return;
  }
  startFromForm();
});
if($("stopBtn"))$("stopBtn").addEventListener("click",stopTimer);

/* Interval/Tabata setup panel — a self-contained extra block (see
   scripts/build-timer-pages.mjs INTERVAL_EXTRA), wired defensively like every
   other extra-row control since it's absent on every non-interval page. */
if($("ivStartBtn"))$("ivStartBtn").addEventListener("click",()=>{
  startInterval(
    numOr($("ivWorkSec")&&$("ivWorkSec").value,20),
    numOr($("ivRestSec")&&$("ivRestSec").value,10),
    numOr($("ivRounds")&&$("ivRounds").value,8),
    $("evtName")?$("evtName").value:""
  );
  $("boardEl").scrollIntoView({behavior:"smooth",block:"nearest"});
});

/* live-preview the label on the ready board as it's typed */
if($("evtName"))$("evtName").addEventListener("input",e=>{
  if(state!=="running")$("evtLabel").textContent=e.target.value;
});

if($("shareBtn"))$("shareBtn").addEventListener("click",async e=>{
  const link=makeLink();
  // On touch devices, the native share sheet (WhatsApp/Messages/etc.) beats a
  // silent clipboard copy; everywhere else, copy is the pro move.
  if(navigator.share&&matchMedia("(pointer:coarse)").matches){
    try{await navigator.share({title:label||"CountLink shared timer",url:link});return}
    catch(err){if(err&&err.name==="AbortError")return}
  }
  const done=flashCopyResult($("shareBtn"),"Link copied — send it","Couldn't copy — the link is on the board above");
  done(await copyText(link));
});
/* QR code: the one on-demand, opt-in feature that calls a third-party API
   (goqr.me) — only fires when the viewer explicitly asks for it, and only
   ever sends the already-public share link, never anything else. */
if($("qrBtn"))$("qrBtn").addEventListener("click",()=>{
  // Sets the label SPAN's text, not the button's, so the icon svg markup
  // (see index.html) survives every toggle instead of being wiped by a
  // plain textContent assignment on the whole button.
  const label=$("qrBtnLabel")||$("qrBtn");
  const showing=$("qrWrap").style.display!=="none";
  if(showing){$("qrWrap").style.display="none";label.textContent="Show QR code";return;}
  const data=encodeURIComponent(makeLink());
  $("qrImg").src=`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${data}`;
  $("qrWrap").style.display="block";label.textContent="Hide QR code";
});
/* Phone control (see realtime-config.js/realtime.js): the checkbox and the
   "Copy control link" row both stay hidden — not just unused — on any site
   that hasn't configured an Ably key, so there's nothing half-finished for
   a visitor to notice. */
if(window.CountlinkRealtime&&window.CountlinkRealtime.enabled&&$("phoneControlRow")){
  $("phoneControlRow").style.display="";
}
if($("controlLinkBtn"))$("controlLinkBtn").addEventListener("click",async e=>{
  const link=makeControlLink();
  if(!link)return;
  if(navigator.share&&matchMedia("(pointer:coarse)").matches){
    try{await navigator.share({title:"Control "+(label||"this countdown"),url:link});return}
    catch(err){if(err&&err.name==="AbortError")return}
  }
  const done=flashCopyResult($("controlLinkBtn"),"Control link copied — open it on your phone","Couldn't copy — use the QR code below instead");
  done(await copyText(link));
});
if($("controlQrBtn"))$("controlQrBtn").addEventListener("click",()=>{
  const lbl=$("controlQrBtnLabel")||$("controlQrBtn");
  const showing=$("controlQrWrap").style.display!=="none";
  if(showing){$("controlQrWrap").style.display="none";lbl.textContent="Show QR code";return;}
  const link=makeControlLink();
  if(!link)return;
  $("controlQrImg").src=`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(link)}`;
  $("controlQrWrap").style.display="block";lbl.textContent="Hide QR code";
});
/* OBS/Twitch pages only: same link, plus ?overlay=1 so whoever pastes it into
   a Browser Source gets the transparent, chrome-stripped view automatically —
   see docs/battle-plan-sharemytimer.md §2 and the SXO audit finding that this
   feature existed in code but was never surfaced on its own landing pages. */
if($("overlayBtn"))$("overlayBtn").addEventListener("click",async e=>{
  const u=new URL(makeLink());
  u.searchParams.set("overlay","1");
  const done=flashCopyResult($("overlayBtn"),"Overlay link copied — paste into OBS","Couldn't copy — add ?overlay=1 to the sync link");
  done(await copyText(u.toString()));
});
/* General-purpose embed: the exact same ?overlay=1 mechanism the OBS button
   above uses, generalized into a plain <iframe> snippet for any website —
   the chrome-stripped view was already built for streamers; this just gives
   everyone else a copy-pasteable embed code instead of a bare link. */
if($("embedBtn"))$("embedBtn").addEventListener("click",()=>{
  const showing=$("embedWrap").style.display!=="none";
  if(showing){$("embedWrap").style.display="none";$("embedBtn").textContent="Embed on your site →";return;}
  const u=new URL(makeLink());
  u.searchParams.set("overlay","1");
  /* Serve the overlay from /embed/ rather than the site root. _headers sends
     X-Frame-Options: DENY for the whole site — which silently made every
     embed of this widget fail on other people's pages — and that header can
     only be lifted per-path, not per-query-string. /embed/ is the same
     document with the framing exemption applied. */
  u.pathname = "/embed/";
  /* The <a> deliberately sits OUTSIDE the iframe: a link inside a frame is
     attributed to the frame's own document (countlink.app), not to the host
     page, so an iframe on its own earns no link back. This line is the only
     part of the snippet that does. */
  $("embedCode").value=`<iframe src="${u.toString()}" width="400" height="160" style="border:0" title="${label||"Countdown"} — CountLink" loading="lazy"></iframe>\n<p style="font-size:13px"><a href="https://countlink.app/">Shared countdown by CountLink</a></p>`;
  $("embedWrap").style.display="block";$("embedBtn").textContent="Hide embed code";
});
if($("embedCopyBtn"))$("embedCopyBtn").addEventListener("click",async e=>{
  const done=flashCopyResult($("embedCopyBtn"),"Copied ✓","Couldn't copy — select the code above");
  done(await copyText($("embedCode").value));
});
if($("fsBtn"))$("fsBtn").addEventListener("click",()=>{
  document.body.classList.toggle("fs");
  const on=document.body.classList.contains("fs");
  $("fsBtn").textContent=on?"Exit fullscreen":"Fullscreen";
  $("fsBtn").setAttribute("aria-pressed",on);
});
if($("soundBtn"))$("soundBtn").addEventListener("click",e=>{
  sound=!sound;
  e.target.textContent="Sound: "+(sound?"on":"off");
  e.target.setAttribute("aria-pressed",sound);
});
if($("alarmToneSelect")){
  $("alarmToneSelect").value=alarmTone;
  $("alarmToneSelect").addEventListener("change",e=>{
    alarmTone=e.target.value;
    try{localStorage.setItem("samesecond_alarm_tone",alarmTone)}catch(err){}
    if(sound){const tones=alarmTones();(tones[alarmTone]||tones.chime)(ctx());} // preview
  });
}

/* ---------- board style: a per-viewer local preference, never part of the shared link ---------- */
function applyStyle(name){
  const board=$("boardEl");
  if(!board)return; // no board on pages without one (e.g. the multi-timer dashboard)
  board.classList.toggle("style-minimal",name==="minimal");
  board.classList.toggle("style-light",name==="light");
  document.querySelectorAll(".style-toggle button").forEach(b=>{
    b.classList.toggle("active",b.dataset.style===name);
    b.setAttribute("aria-pressed",b.dataset.style===name);
  });
  try{localStorage.setItem("samesecond_style",name)}catch(e){}
}
document.querySelectorAll(".style-toggle button").forEach(b=>b.addEventListener("click",()=>applyStyle(b.dataset.style)));
let savedStyle="board";
try{savedStyle=localStorage.getItem("samesecond_style")||"board"}catch(e){}
applyStyle(savedStyle);

/* OBS/streaming Browser Source support — see docs/battle-plan-sharemytimer.md §2.
   ?overlay=1 strips the page to a transparent-background board so only the
   digits sit over the video capture. Applied before first render so there's
   no flash of the normal chrome. */
if(new URLSearchParams(location.search).get("overlay"))document.body.classList.add("overlay-mode");

function bootFromHash(){
  // A device opening someone else's shared link never calls start(), so the
  // tile-count mode has to be derived here too — from the remaining time at
  // the moment THIS device loaded the link, then fixed from that point on.
  // (Interval mode always renders via an explicit "ms" override in draw(),
  // so the exact value of `mode` here doesn't matter for it — set anyway
  // for consistency with every other mode.)
  total=end-Date.now();
  mode = modeForHash(direction,total);
  fired=false;prevValues=null;lastSecond=null;ivPhaseKey=null;
  // A recipient came for the timer, not the pitch — hide the marketing hero
  // so the board is the first thing on their screen.
  document.body.classList.add("viewing");
  saveRecent();
  // A link opened while its countdown is paused carries &p=<remaining> (see
  // makeLink()/readHash()) — boot straight into the frozen state instead of
  // running, so a late viewer doesn't see it ticking for one frame first.
  if(direction==="down"&&hashPausedRemaining!=null){
    pausedRemaining=hashPausedRemaining;
    setState("paused");
    renderPausedTiles();
  }else{
    setState("running");
    render();
  }
  connectRealtimeIfNeeded();
  updateControlLinkUI();
}

// ---------- Multi-timer dashboard ----------
// Several independent countdowns tracked at once (e.g. multiple kitchen
// timers), each with its own end instant — same "the link is the timer"
// mechanic as everywhere else, just an array of {label,end} in the hash
// instead of one. Deliberately a plain countdown per card (mm:ss text, no
// split-flap tiles) — this is a different, simpler display, not a grid of
// full boards.
let multiTimers=[]; // [{label, end}]
function encodeMultiHash(){
  return "m="+encodeURIComponent(JSON.stringify(multiTimers));
}
function decodeMultiHash(){
  const m=new URLSearchParams(location.hash.slice(1)).get("m");
  if(!m)return [];
  try{
    const parsed=JSON.parse(decodeURIComponent(m));
    if(Array.isArray(parsed))return parsed.filter(t=>t&&typeof t.end==="number"&&typeof t.label==="string");
  }catch(e){}
  return [];
}
function fmtMulti(ms){
  const s=Math.max(0,Math.floor(ms/1000));
  const h=Math.floor(s/3600),mn=Math.floor(s%3600/60),sec=s%60;
  return h>0?`${fmt2(h)}:${fmt2(mn)}:${fmt2(sec)}`:`${fmt2(mn)}:${fmt2(sec)}`;
}
function initMultiDashboard(){
  const cardsEl=$("multiCards");
  const labelEl=$("multiLabel"),minutesEl=$("multiMinutes");
  multiTimers=decodeMultiHash();
  function persist(){ history.replaceState(null,"",location.pathname+location.search+"#"+encodeMultiHash()); }
  function renderCards(){
    let anyActive=false;
    cardsEl.innerHTML=multiTimers.map((t,i)=>{
      const left=t.end-Date.now();
      const done=left<=0;
      if(!done)anyActive=true;
      return `<div class="multi-card${done?" done":""}" data-i="${i}">
        <div class="multi-card-label">${esc(t.label)||"Timer "+(i+1)}</div>
        <div class="multi-card-time">${done?"Done":fmtMulti(left)}</div>
        <button type="button" class="multi-card-remove" data-remove="${i}" aria-label="Remove this timer">×</button>
      </div>`;
    }).join("") || `<p class="hint">No timers yet — add one above.</p>`;
    setWakeLockActive(anyActive);
  }
  renderCards();
  persist();
  setInterval(renderCards,250);

  if($("multiAddBtn"))$("multiAddBtn").addEventListener("click",()=>{
    const mins=Math.max(1,numOr(minutesEl.value,5));
    const label=(labelEl.value||"").trim();
    multiTimers.push({label,end:Date.now()+mins*60000});
    labelEl.value="";
    renderCards();
    persist();
  });
  cardsEl.addEventListener("click",(e)=>{
    const btn=e.target.closest("[data-remove]");
    if(!btn)return;
    multiTimers.splice(+btn.dataset.remove,1);
    renderCards();
    persist();
  });
  if($("multiClearBtn"))$("multiClearBtn").addEventListener("click",()=>{
    multiTimers=[];
    renderCards();
    persist();
  });
  if($("multiShareBtn"))$("multiShareBtn").addEventListener("click",async (e)=>{
    flashCopyResult(e.currentTarget,"Link copied ✓","Couldn't copy — copy the address bar")(await copyText(location.href));
  });
  window.addEventListener("hashchange",()=>{multiTimers=decodeMultiHash();renderCards();});
}

// ---------- Agenda timer: an ordered, auto-advancing sequence ----------
// Same "the link is the timer" mechanic as startInterval() above, generalized
// from one repeating work/rest pair to an arbitrary ordered list of named,
// different-length segments. Only {segments, start} ever go in the hash —
// every viewer derives "which segment is active, how much of it is left"
// from Date.now()-start, so no server ever has to push an "advance" event.
function encodeAgendaHash(segments,start){
  return "ag="+encodeURIComponent(JSON.stringify(segments))+"&s="+start;
}
// Pure parser, split out from decodeAgendaHash() below purely so it's testable
// without a `location` global — takes the raw hash string (no leading "#"),
// same shape URLSearchParams(location.hash.slice(1)) would give it.
function parseAgendaHash(hashStr){
  const m=new URLSearchParams(hashStr||"");
  const raw=m.get("ag"),s=m.get("s");
  if(!raw||!s)return null;
  try{
    const segments=JSON.parse(decodeURIComponent(raw));
    if(!Array.isArray(segments)||!segments.length)return null;
    const clean=segments.filter(seg=>seg&&typeof seg.label==="string"&&typeof seg.minutes==="number"&&seg.minutes>0);
    if(!clean.length)return null;
    return {segments:clean,start:+s};
  }catch(e){return null;}
}
function decodeAgendaHash(){
  return parseAgendaHash(location.hash.slice(1));
}
// cumulative END time of each segment, in ms from the agenda's own start
function boundaries(segments){
  let acc=0;
  return segments.map(seg=>{acc+=seg.minutes*60000;return acc;});
}
function fmtAgenda(ms){
  const s=Math.max(0,Math.ceil(ms/1000));
  const m=Math.floor(s/60),sec=s%60;
  return `${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
}
// The auto-advance derivation itself — pure function of (segments, start, now),
// no DOM, no Date.now() call baked in, so it's directly testable: given a
// start instant and elapsed time, which segment is active and how much of the
// whole agenda is left. idx===-1 means the agenda has finished.
function computeAgendaState(segments,start,now){
  const bounds=boundaries(segments);
  const total=bounds[bounds.length-1];
  const elapsed=now-start;
  const idx=bounds.findIndex(b=>elapsed<b);
  return {bounds,total,elapsed,idx};
}
function initAgendaDashboard(){
  let agendaSegments=[];
  const builderEl=$("agendaBuilder"),runningEl=$("agendaRunning");
  const listEl=$("agendaList"),runningListEl=$("agendaRunningList");
  const labelEl=$("agendaLabel"),minutesEl=$("agendaMinutes");
  let agendaTick=null,agendaFired=false;


  function renderBuilderList(){
    listEl.innerHTML=agendaSegments.map((seg,i)=>`
      <li class="agenda-item" data-i="${i}">
        <span class="agenda-item-order">${i+1}</span>
        <span class="agenda-item-label">${esc(seg.label)||"Segment "+(i+1)}</span>
        <span class="agenda-item-mins">${seg.minutes} min</span>
        <button type="button" class="agenda-item-btn" data-up="${i}" ${i===0?"disabled":""} aria-label="Move up">↑</button>
        <button type="button" class="agenda-item-btn" data-down="${i}" ${i===agendaSegments.length-1?"disabled":""} aria-label="Move down">↓</button>
        <button type="button" class="agenda-item-btn" data-remove="${i}" aria-label="Remove">×</button>
      </li>`).join("") || `<li class="hint" style="list-style:none">No segments yet — add one above.</li>`;
  }

  function renderRunning(segments,start){
    const {bounds,total,elapsed,idx}=computeAgendaState(segments,start,Date.now());

    runningListEl.innerHTML=segments.map((seg,i)=>{
      const state=idx===-1||i<idx?"done":i===idx?"current":"upcoming";
      return `<li class="agenda-item agenda-item--${state}">
        <span class="agenda-item-order">${state==="done"?"✓":i+1}</span>
        <span class="agenda-item-label">${esc(seg.label)||"Segment "+(i+1)}</span>
        <span class="agenda-item-mins">${seg.minutes} min</span>
      </li>`;
    }).join("");

    if(idx===-1){
      setWakeLockActive(false);
      $("agendaNowLabel").textContent="Agenda complete";
      $("agendaNowTime").textContent="00:00";
      $("agendaNowSub").textContent=segments.length+" segment"+(segments.length===1?"":"s")+" finished.";
      if(!agendaFired){agendaFired=true;beep();}
      return;
    }
    setWakeLockActive(true);
    const segStart=idx===0?0:bounds[idx-1];
    const remainingInSeg=bounds[idx]-elapsed;
    const totalRemaining=total-elapsed;
    $("agendaNowLabel").textContent=(segments[idx].label||"Segment "+(idx+1));
    $("agendaNowTime").textContent=fmtAgenda(remainingInSeg);
    $("agendaNowSub").textContent=`Segment ${idx+1} of ${segments.length} · ${fmtAgenda(totalRemaining)} left in the whole agenda`;
  }

  function bootRunning(){
    const decoded=decodeAgendaHash();
    if(!decoded){showBuilder();return;}
    builderEl.hidden=true;runningEl.hidden=false;
    agendaFired=false;
    clearInterval(agendaTick);
    renderRunning(decoded.segments,decoded.start);
    agendaTick=setInterval(()=>renderRunning(decoded.segments,decoded.start),250);
  }
  function showBuilder(){
    clearInterval(agendaTick);agendaTick=null;
    setWakeLockActive(false);
    builderEl.hidden=false;runningEl.hidden=true;
    renderBuilderList();
  }

  if($("agendaAddBtn"))$("agendaAddBtn").addEventListener("click",()=>{
    const mins=Math.max(1,numOr(minutesEl.value,5));
    const label=(labelEl.value||"").trim();
    agendaSegments.push({label,minutes:mins});
    labelEl.value="";
    renderBuilderList();
    labelEl.focus();
  });
  listEl.addEventListener("click",(e)=>{
    const btn=e.target.closest("button");
    if(!btn)return;
    if(btn.dataset.remove!==undefined)agendaSegments.splice(+btn.dataset.remove,1);
    else if(btn.dataset.up!==undefined){const i=+btn.dataset.up;[agendaSegments[i-1],agendaSegments[i]]=[agendaSegments[i],agendaSegments[i-1]];}
    else if(btn.dataset.down!==undefined){const i=+btn.dataset.down;[agendaSegments[i+1],agendaSegments[i]]=[agendaSegments[i],agendaSegments[i+1]];}
    renderBuilderList();
  });
  if($("agendaClearBtn"))$("agendaClearBtn").addEventListener("click",()=>{
    agendaSegments=[];renderBuilderList();
  });
  if($("agendaStartBtn"))$("agendaStartBtn").addEventListener("click",()=>{
    if(!agendaSegments.length)return;
    const start=Date.now();
    location.hash=encodeAgendaHash(agendaSegments,start);
    bootRunning();
  });
  if($("agendaShareBtn"))$("agendaShareBtn").addEventListener("click",async (e)=>{
    flashCopyResult(e.currentTarget,"Link copied ✓","Couldn't copy — copy the address bar")(await copyText(location.href));
  });
  if($("agendaRestartBtn"))$("agendaRestartBtn").addEventListener("click",()=>{
    agendaSegments=[];
    history.replaceState(null,"",location.pathname+location.search);
    showBuilder();
  });
  window.addEventListener("hashchange",()=>{decodeAgendaHash()?bootRunning():showBuilder();});

  decodeAgendaHash()?bootRunning():showBuilder();
}

// Multi-timer dashboard is a completely separate page/flow from the single-
// countdown board above — several independent timers, not one deadline — so
// it gets its own init path and returns here rather than running any of the
// single-timer boot sequence below, which assumes board/setup elements
// (#untilTime, #evtLabel, #tiles, ...) exist and would throw if they don't.
// The agenda dashboard is a third, equally separate flow, gated the same way.
if(document.getElementById("multiDashboard")){
  initMultiDashboard();
}else if(document.getElementById("agendaDashboard")){
  initAgendaDashboard();
}else{

setDefaultUntil();
if(readHash()){
  bootFromHash();
}else{
  /* Landing pages (see /timers/) set window.COUNTLINK_DEFAULT before this script runs,
     so the tool boots ready at that page's advertised duration — started by the
     visitor, not for them. Two special shapes beyond {minutes,label}:
     - {direction:"up"}          → stopwatch page: boot ready in count-up mode
     - {untilMonthDay:[m,d]}     → date-countdown page (New Year, Christmas):
       the NEXT occurrence is computed client-side at load, so the page never
       goes stale when the date passes — no yearly rebuild needed. */
  const d=window.COUNTLINK_DEFAULT||{minutes:10,label:""};
  if($("evtName")&&!$("evtName").value)$("evtName").value=d.label;
  if($("customMin")&&d.minutes)$("customMin").value=d.minutes;
  if(d.direction==="up"){
    const up=document.querySelector('.dir-toggle .q[data-dir="up"]');
    if(up)up.click(); // runs the toggle handler, which ends in renderReady()
  }else if(d.untilMonthDay){
    const now=new Date();
    let t=new Date(now.getFullYear(),d.untilMonthDay[0]-1,d.untilMonthDay[1],0,0,0);
    if(t<=now)t=new Date(now.getFullYear()+1,d.untilMonthDay[0]-1,d.untilMonthDay[1],0,0,0);
    const p=n=>String(n).padStart(2,"0");
    $("untilTime").value=`${t.getFullYear()}-${p(t.getMonth()+1)}-${p(t.getDate())}T00:00`;
    $("untilTime").dataset.dirty=1; // Start uses the date field, not custom minutes
    renderReady(0,$("evtName")?$("evtName").value:d.label,t-now);
  }else{
    renderReady(d.minutes,$("evtName")?$("evtName").value:d.label);
  }
}
renderRecent();
/* Recent-timer links point at this same page with a different hash — no page
   load happens, so re-boot the board on hashchange. */
window.addEventListener("hashchange",()=>{if(readHash())bootFromHash();});

}

})();
