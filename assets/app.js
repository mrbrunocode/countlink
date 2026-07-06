/* samesecond — shared countdown timer logic. One file, used by index.html and every /timers/*.html page. */
const $=id=>document.getElementById(id);
let end=null,label="",sound=true,pro=false,fired=false,tick=null,total=0;

function fmt(n){return String(n).padStart(2,"0")}
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
  end=Date.now()+ms;label=lab;fired=false;total=ms;
  location.hash=`t=${end}&l=${encodeURIComponent(label)}`;
  render();
}
function beep(){
  if(!sound)return;
  const ctx=new (window.AudioContext||window.webkitAudioContext)();
  [0,.28,.56].forEach((t,i)=>{
    const o=ctx.createOscillator(),g=ctx.createGain();
    o.frequency.value=i===2?1318:880;o.type="sine";
    g.gain.setValueAtTime(.32,ctx.currentTime+t);
    g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+t+.24);
    o.connect(g).connect(ctx.destination);o.start(ctx.currentTime+t);o.stop(ctx.currentTime+t+.25);
  });
}
function render(){clearInterval(tick);tick=setInterval(draw,250);draw();}
function draw(){
  if(!end)return;
  const left=end-Date.now();
  $("evtLabel").textContent=label||"";
  const d=$("digits");
  if(left<=0){
    d.textContent="00:00";d.classList.add("done");
    $("subLine").innerHTML="<b>Time.</b> This screen — and every screen with your link — just hit zero together.";
    $("barFill").style.width="100%";
    if(!fired){fired=true;beep();}
    return;
  }
  d.classList.remove("done");
  const s=Math.floor(left/1000),h=Math.floor(s/3600),m=Math.floor(s%3600/60),sec=s%60,days=Math.floor(h/24);
  d.innerHTML=days>0
    ? `${days}<span class="unit">d</span>${fmt(h%24)}<span class="unit">h</span>${fmt(m)}<span class="unit">m</span>${fmt(sec)}<span class="unit">s</span>`
    : (h>0?`${fmt(h)}:${fmt(m)}:${fmt(sec)}`:`${fmt(m)}:${fmt(sec)}`);
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
  total=end-Date.now();render();
}else{
  /* Landing pages (see /timers/) set window.SAMESECOND_DEFAULT before this script runs,
     so the tool boots straight into that page's advertised duration. */
  const d=window.SAMESECOND_DEFAULT||{minutes:10,label:"Workshop resumes"};
  if($("evtName")&&!$("evtName").value)$("evtName").value=d.label;
  if($("customMin"))$("customMin").value=d.minutes;
  start(d.minutes*60e3,d.label);
}
