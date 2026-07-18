/* CountLink — split-flap countdown logic. Shared by index.html and every /timers/*.html page. */
(function(){

const $=id=>document.getElementById(id);
let end=null,label="",sound=true,fired=false,tick=null,total=0;
let mode=null;        // "hms" | "ms" | "days" — decided once per start() so tile count stays fixed
let prevValues=null;  // last rendered digit string per tile, so we only flip tiles that changed
let audioCtx=null;
let direction="down"; // "down" (countdown) | "up" (stopwatch/count-up) | "interval" (repeating work/rest cycle).
                      // In "up" and "interval" modes, `end` holds the START instant instead of
                      // the deadline — same single timestamp-in-the-link mechanic, just read
                      // the other way; "interval" additionally derives which phase/round is
                      // current from elapsed time, rather than counting to one fixed deadline.
let ivWork=20,ivRest=10,ivRounds=8; // interval mode: work/rest seconds per round, total rounds
/* The board has three lifecycle states, driving which buttons show:
   "ready"    — nothing running; preset duration displayed; Start lives ON the board
   "running"  — counting; Share/Stop replace Start
   "finished" — hit zero; Restart (same duration) + New timer offered.
   Pages no longer auto-start on load — someone landing from a search result
   decides when their five minutes begin, instead of finding 30 seconds
   already gone by the time they've read the page. */
let state="ready";

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
  module.exports = { fmt2: fmt2, charsFor: charsFor, numOr: numOr };
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

function setDefaultUntil(){
  const d=new Date(Date.now()+3600e3);d.setSeconds(0,0);
  const p=n=>String(n).padStart(2,"0");
  $("untilTime").value=`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function makeLink(){
  const u=new URL(location.href);
  const dirParam=direction==="up"?"&d=up":direction==="interval"?`&d=iv&w=${ivWork}&r=${ivRest}&n=${ivRounds}`:"";
  u.hash=`t=${end}&l=${encodeURIComponent(label)}${dirParam}`;
  return u.toString();
}
function readHash(){
  const m=new URLSearchParams(location.hash.slice(1));
  if(m.get("t")){
    end=+m.get("t");label=decodeURIComponent(m.get("l")||"");
    if(m.get("d")==="up")direction="up";
    else if(m.get("d")==="iv"){
      direction="interval";
      ivWork=Math.max(1,numOr(m.get("w"),20));ivRest=Math.max(0,numOr(m.get("r"),10));ivRounds=Math.max(1,numOr(m.get("n"),8));
    }else direction="down";
    return true;
  }
  return false;
}

function setState(s){
  state=s;
  const show=(id,on)=>{const el=$(id);if(el)el.style.display=on?"":"none"};
  show("boardStartBtn",s!=="running");
  show("shareBtn",s==="running");
  show("stopBtn",s!=="ready");
  show("syncDot",s==="running");
  const bs=$("boardStartBtn");
  if(bs)bs.textContent = s==="finished" ? "Restart — same duration"
    : (formDirection==="up" ? "Start counting up" : "Start countdown");
  const st=$("stopBtn");
  if(st)st.textContent = s==="finished" ? "New timer" : "Stop";
  const note=$("syncMsg");
  if(note)note.textContent = s==="running"
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
  location.hash=`t=${end}&l=${encodeURIComponent(label)}`;
  lastAnnouncedMin=null;announcedFinal=false;
  announce(`Countdown started: ${Math.round(ms/60e3)} minutes${label?", "+label:""}`);
  saveRecent();
  setState("running");
  render();
}
function startUp(lab){
  direction="up";
  end=Date.now();label=lab;fired=false;total=0;prevValues=null;
  mode="hms"; // always 6 tiles — an open-ended stopwatch can run past an hour, so never a 4-tile start
  location.hash=`t=${end}&l=${encodeURIComponent(label)}&d=up`;
  lastAnnouncedMin=null;announcedFinal=false;
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
  ivWork=Math.max(1,workSec);ivRest=Math.max(0,restSec);ivRounds=Math.max(1,rounds);
  mode="ms";
  location.hash=`t=${end}&l=${encodeURIComponent(label)}&d=iv&w=${ivWork}&r=${ivRest}&n=${ivRounds}`;
  lastAnnouncedMin=null;announcedFinal=false;
  announce(`Interval timer started: ${ivRounds} rounds of ${ivWork}s work, ${ivRest}s rest`);
  saveRecent();
  setState("running");
  render();
}
/* Stop is honest about what it can do: with no server, there is no way to
   halt a countdown on screens that already have the link — the link IS the
   timer. Stopping resets THIS screen back to ready. */
function stopTimer(){
  clearInterval(tick);tick=null;end=null;fired=false;prevValues=null;lastSecond=null;
  history.replaceState(null,"",location.pathname+location.search);
  document.body.classList.remove("viewing");
  renderReady(+($("customMin")&&$("customMin").value)||10,$("evtName")?$("evtName").value:"");
  const heads=$("subLine");
  if(heads)heads.innerHTML="Stopped on this screen. A link you already shared keeps counting on other screens — the link itself is the timer.";
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
  if(c.plain)$("tiles").innerHTML=`<div class="tile-day">${c.plain}</div>`;
  else buildTiles(c.tiles);
  prevValues=null;
  $("subLine").innerHTML=formDirection==="up"
    ? "A shared stopwatch — starts from zero when you press start."
    : (msOverride!=null
      ? `counting to <b>${new Date(Date.now()+ms).toLocaleDateString([],{month:"short",day:"numeric"})}</b> — you'll get a share link the moment you start`
      : `<b>${min} minute${min===1?"":"s"}</b>, ready — you'll get a share link the moment you start`);
  $("barFill").style.width="0%";
  const bar=document.querySelector(".bar");if(bar)bar.style.display="";
  if($("shareUrl"))$("shareUrl").textContent="";
  setState("ready");
}

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
function beep(){
  if(!sound)return;
  const c=ctx();
  [0,.28,.56].forEach((t,i)=>{
    const o=c.createOscillator(),g=c.createGain();
    o.frequency.value=i===2?1318:880;o.type="sine";
    g.gain.setValueAtTime(.32,c.currentTime+t);
    g.gain.exponentialRampToValueAtTime(.001,c.currentTime+t+.24);
    o.connect(g).connect(c.destination);o.start(c.currentTime+t);o.stop(c.currentTime+t+.25);
  });
}

/* ---------- split-flap tile rendering ---------- */
function buildTiles(chars){
  // chars: array of {t:"tile"|"sep", v:string}
  const board=$("tiles");
  board.innerHTML="";
  chars.forEach((c,i)=>{
    if(c.t==="sep"){
      const s=document.createElement("div");
      s.className="tile-sep";s.textContent=c.v;
      board.appendChild(s);
      return;
    }
    const tile=document.createElement("div");
    tile.className="tile";tile.dataset.idx=i;
    tile.innerHTML=`
      <div class="flap"><span class="num">${c.v}</span></div>
      <div class="half top"><span class="num">${c.v}</span></div>
      <div class="half bottom"><span class="num">${c.v}</span></div>`;
    board.appendChild(tile);
  });
}
function updateTiles(chars){
  const board=$("tiles");
  const tileEls=[...board.querySelectorAll(".tile")];
  let ti=0;
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
    if(!document.querySelector(".tile")||prevValues===null){buildTiles(c.tiles);prevValues=true;}
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
      if(!fired){fired=true;beep();setState("finished");announceLeft(0);}
      return;
    }
    document.querySelector(".bar").style.display="";
    const posMs=elapsedMs%(cycleSec*1000);
    const round=Math.floor(elapsedMs/(cycleSec*1000))+1;
    const inWork=posMs<ivWork*1000;
    const phaseLeftMs=inWork?ivWork*1000-posMs:cycleSec*1000-posMs;
    const c=charsFor(phaseLeftMs,"ms");
    const curSecond=Math.floor(phaseLeftMs/1000);
    if(!document.querySelector(".tile")||prevValues===null){buildTiles(c.tiles);prevValues=true;}
    else updateTiles(c.tiles);
    if(lastSecond!==null&&curSecond!==lastSecond)tick_sound();
    lastSecond=curSecond;
    if(ivPhaseEl)ivPhaseEl.textContent=`${inWork?"WORK":"REST"} — round ${round} of ${ivRounds}`;
    $("evtLabel").textContent=`${inWork?"WORK":"REST"} — round ${round} of ${ivRounds}`+(label?" · "+label:"");
    announceLeft(phaseLeftMs);
    $("subLine").innerHTML=`round <b>${round} of ${ivRounds}</b> — synced on every screen with this link`;
    $("barFill").style.width=Math.max(0,Math.min(100,(1-phaseLeftMs/((inWork?ivWork:cycleSec)*1000))*100))+"%";
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
    if(!fired){fired=true;beep();setState("finished");announceLeft(0);}
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
    return `<a class="recent-item" href="${r.u}"><span class="rl">${(r.l||"Untitled timer").replace(/[<>&]/g,ch=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[ch]))}</span><span class="rs">${status}</span></a>`;
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
  if(state!=="running")renderReady(+$("customMin").value||10,$("evtName").value);
}));

function startFromForm(){
  if(formDirection==="up"){startUp($("evtName").value);return;}
  const dirty=$("untilTime").dataset.dirty;
  if(dirty)start(new Date($("untilTime").value)-Date.now(),$("evtName").value);
  else start((+$("customMin").value||25)*60e3,$("evtName").value);
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
    else if(total>0)start(total,label);
    // A recipient who opened the link after it already expired never had a
    // positive `total` to begin with — there's no way to recover the
    // original duration with no server, so this page's own default length
    // is the honest fallback. But `label` (synced from the actual link via
    // readHash()) is always correct — startFromForm() reads the evtName
    // FORM FIELD instead, which a recipient's page never syncs to the link's
    // real label, so it silently restarted under the page's stale default
    // text rather than the timer that just finished.
    else start((+$("customMin").value||25)*60e3,label);
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
  await navigator.clipboard.writeText(link);
  e.target.classList.add("copied");e.target.textContent="Link copied — send it";
  setTimeout(()=>{e.target.classList.remove("copied");e.target.textContent="Copy sync link";},1800);
});
/* QR code: the one on-demand, opt-in feature that calls a third-party API
   (goqr.me) — only fires when the viewer explicitly asks for it, and only
   ever sends the already-public share link, never anything else. */
if($("qrBtn"))$("qrBtn").addEventListener("click",()=>{
  const showing=$("qrWrap").style.display!=="none";
  if(showing){$("qrWrap").style.display="none";$("qrBtn").textContent="Show QR code →";return;}
  const data=encodeURIComponent(makeLink());
  $("qrImg").src=`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${data}`;
  $("qrWrap").style.display="block";$("qrBtn").textContent="Hide QR code";
});
/* OBS/Twitch pages only: same link, plus ?overlay=1 so whoever pastes it into
   a Browser Source gets the transparent, chrome-stripped view automatically —
   see docs/battle-plan-sharemytimer.md §2 and the SXO audit finding that this
   feature existed in code but was never surfaced on its own landing pages. */
if($("overlayBtn"))$("overlayBtn").addEventListener("click",async e=>{
  const u=new URL(makeLink());
  u.searchParams.set("overlay","1");
  await navigator.clipboard.writeText(u.toString());
  e.target.textContent="Overlay link copied — paste into OBS";
  setTimeout(()=>{e.target.textContent="Copy OBS overlay link →";},2200);
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
  $("embedCode").value=`<iframe src="${u.toString()}" width="400" height="160" style="border:0" title="${label||"Countdown"} — CountLink"></iframe>`;
  $("embedWrap").style.display="block";$("embedBtn").textContent="Hide embed code";
});
if($("embedCopyBtn"))$("embedCopyBtn").addEventListener("click",async e=>{
  await navigator.clipboard.writeText($("embedCode").value);
  e.target.textContent="Copied ✓";
  setTimeout(()=>{e.target.textContent="Copy embed code";},1600);
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
  mode = direction==="interval"?"ms":total>=86400000?"days":total>=3600000?"hms":"ms";
  fired=false;prevValues=null;lastSecond=null;
  // A recipient came for the timer, not the pitch — hide the marketing hero
  // so the board is the first thing on their screen.
  document.body.classList.add("viewing");
  saveRecent();
  setState("running");
  render();
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
    cardsEl.innerHTML=multiTimers.map((t,i)=>{
      const left=t.end-Date.now();
      const done=left<=0;
      return `<div class="multi-card${done?" done":""}" data-i="${i}">
        <div class="multi-card-label">${t.label.replace(/[<>&]/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]))||"Timer "+(i+1)}</div>
        <div class="multi-card-time">${done?"Done":fmtMulti(left)}</div>
        <button type="button" class="multi-card-remove" data-remove="${i}" aria-label="Remove this timer">×</button>
      </div>`;
    }).join("") || `<p class="hint">No timers yet — add one above.</p>`;
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
    await navigator.clipboard.writeText(location.href);
    const t=e.target.textContent;e.target.textContent="Link copied ✓";
    setTimeout(()=>{e.target.textContent=t;},1600);
  });
  window.addEventListener("hashchange",()=>{multiTimers=decodeMultiHash();renderCards();});
}

// Multi-timer dashboard is a completely separate page/flow from the single-
// countdown board above — several independent timers, not one deadline — so
// it gets its own init path and returns here rather than running any of the
// single-timer boot sequence below, which assumes board/setup elements
// (#untilTime, #evtLabel, #tiles, ...) exist and would throw if they don't.
if(document.getElementById("multiDashboard")){
  initMultiDashboard();
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
