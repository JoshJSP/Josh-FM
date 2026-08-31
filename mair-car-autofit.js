// MAIRFM Car Mode — adaptive text sizing for constrained labels.
(()=>{
'use strict';
if(window.MAIRCarAutoFit)return;
const ROOT='#mairCarWaveOverlay';
const targets=[
  ['.car-track-copy h1',22,42],
  ['.car-track-copy p',13,20],
  ['.car-next b',11,17],
  ['.car-next span',10,15],
  ['.car-nav-maneuver strong',11,18],
  ['.car-stop-chip',9,13],
  ['.mair-stop-primary span',8,11],
  ['.car-preview-card b',11,18],
  ['.car-stop-row b',10,16],
  ['.car-turn-hero h1',15,34],
  ['.car-turn-focus header small',10,15],
  ['.car-turn-focus header span',9,13]
];
let queued=false;
function fit(el,min,max){
  if(!el||!el.isConnected)return;
  el.style.fontSize='';
  const base=Math.min(max,parseFloat(getComputedStyle(el).fontSize)||max);
  el.style.fontSize=`${base}px`;
  let size=base,guard=0;
  while(size>min&&guard++<40&&(el.scrollWidth>el.clientWidth+1||el.scrollHeight>el.clientHeight+1)){
    size=Math.max(min,size-1);
    el.style.fontSize=`${size}px`;
  }
}
function run(){queued=false;const root=document.querySelector(ROOT);if(!root)return;targets.forEach(([sel,min,max])=>root.querySelectorAll(sel).forEach(el=>fit(el,min,max)))}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(run)}
const observer=new MutationObserver(schedule);
function boot(){const root=document.querySelector(ROOT);if(root)observer.observe(root,{childList:true,subtree:true,characterData:true});schedule()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.addEventListener('resize',schedule,{passive:true});window.addEventListener('orientationchange',schedule,{passive:true});['jfm:trackchange','jfm:playback-state','mair:journey-context','mair:car-mode'].forEach(n=>window.addEventListener(n,schedule));
window.MAIRCarAutoFit={version:'2026-08-31-v1',refresh:schedule};
})();
