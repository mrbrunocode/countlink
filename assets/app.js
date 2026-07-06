/* samesecond — split-flap countdown logic. Shared by index.html and every /timers/*.html page. */
const $=id=>document.getElementById(id);
let end=null,label="",sound=true,pro=false,fired=false,tick=null,total=0;
let mode=null;        // "hms" | "ms" | "days" — decided once per start() so tile count stays fixed
let prevValues=null;  // last rendered digit string per tile, so we only flip tiles that changed
let audioCtx=null;

function fmt2(n){return String(n).padStart(2,"0")}

function setDefaultUntil(){
  const d=new Date(Date.now()+3600e3);d.setSeconds(0,0);
  const p=n=>String(n).padStart(2,"0");
  $("untilTime").value=`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function makeLink(){
  const u=new URL(location.href);u.hash=`t=${end}&l=${encodeURIComponent(label)}`;
  return u.toString();
}
function readHash(){
  const m=new URLSearchParams(location.hash.slice(1));
  if(m.get("t")){end=+m.get("t");label=decodeURIComponent(m.get("l")||"");return true}
  return false;
}
function start(ms,lab){
  end=Date.now()+ms;label=lab;fired=false;total=ms;prevValues=null;
  /* Tile layout (how many digit tiles are on screen) is fixed once, from the
     STARTING duration — not recomputed each tick. Otherwise an hour+ countdown
     would silently drop from 6 tiles to 4 the moment it crosses under 60
     minutes remaining, breaking the board mid-countdown. */
  mode = ms>=86400000?"days":ms>=3600000?"hms":"ms";
  location.hash=`t=${end}&l=${encodeURIComponent(label)}`;
  render();
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

function charsFor(left){
  // Branches on the FIXED mode decided at start() — never on live h/m/s —
  // so the tile count never changes mid-countdown (see start()).
  const s=Math.max(0,Math.floor(left/1000));
  if(mode==="days"){
    const days=Math.floor(s/86400),h=Math.floor(s%86400/3600);
    return {plain:`${days}d ${fmt2(h)}:${fmt2(Math.floor(s%3600/60))}:${fmt2(s%60)}`};
  }
  if(mode==="hms"){
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

function render(){clearInterval(tick);tick=setInterval(draw,250);draw();}

let lastSecond=null;
function draw(){
  if(!end)return;
  const left=end-Date.now();
  $("evtLabel").textContent=label||"";
  if(left<=0){
    if(mode==="days"||!document.querySelector(".tile")){
      $("tiles").innerHTML=`<div class="tile-day">00:00:00</div>`;
    }else{
      const chars=charsFor(0).tiles;
      if(!document.querySelector(".tile"))buildTiles(chars);else updateTiles(chars);
    }
    $("subLine").innerHTML="<b>Time.</b> This screen — and every screen with your link — just hit zero together.";
    $("barFill").style.width="100%";
    if(!fired){fired=true;beep();}
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
  $("subLine").innerHTML=`ends at <b>${new Date(end).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</b> — synced on every screen with this link`;
  if(total>0)$("barFill").style.width=Math.max(0,Math.min(100,(1-left/total)*100))+"%";
  $("shareUrl").textContent=makeLink();
}

document.querySelectorAll(".q").forEach(b=>b.addEventListener("click",()=>start(+b.dataset.min*60e3,$("evtName").value)));
$("startBtn").addEventListener("click",()=>{
  const dirty=$("untilTime").dataset.dirty;
  if(dirty)start(new Date($("untilTime").value)-Date.now(),$("evtName").value);
  else start((+$("customMin").value||25)*60e3,$("evtName").value);
});
$("untilTime").addEventListener("input",e=>e.target.dataset.dirty=1);
$("shareBtn").addEventListener("click",async e=>{
  await navigator.clipboard.writeText(makeLink());
  e.target.classList.add("copied");e.target.textContent="Link copied — send it";
  setTimeout(()=>{e.target.classList.remove("copied");e.target.textContent="Copy sync link";},1800);
});
$("fsBtn").addEventListener("click",()=>{
  document.body.classList.toggle("fs");
  $("fsBtn").textContent=document.body.classList.contains("fs")?"Exit fullscreen":"Fullscreen";
});
$("soundBtn").addEventListener("click",e=>{sound=!sound;e.target.textContent="Sound: "+(sound?"on":"off")});
$("proBtn").addEventListener("click",e=>{pro=true;e.target.textContent="Pro unlocked ✓";});

setDefaultUntil();
if(readHash()){
  // A device opening someone else's shared link never calls start(), so the
  // tile-count mode has to be derived here too — from the remaining time at
  // the moment THIS device loaded the link, then fixed from that point on.
  total=end-Date.now();
  mode = total>=86400000?"days":total>=3600000?"hms":"ms";
  render();
}else{
  /* Landing pages (see /timers/) set window.SAMESECOND_DEFAULT before this script runs,
     so the tool boots straight into that page's advertised duration. */
  const d=window.SAMESECOND_DEFAULT||{minutes:10,label:"Workshop resumes"};
  if($("evtName")&&!$("evtName").value)$("evtName").value=d.label;
  if($("customMin"))$("customMin").value=d.minutes;
  start(d.minutes*60e3,d.label);
}
