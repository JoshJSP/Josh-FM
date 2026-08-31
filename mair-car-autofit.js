// MAIRFM Car Mode — adaptive text sizing for constrained labels.
(()=>{
'use strict';
if(window.MAIRCarAutoFit)return;
const ROOT='#mairCarWaveOverlay';
const targets=[
  ['.car-track-copy h1',22,42,null],
  ['.car-track-copy p',13,20,null],
  ['.car-next b',11,17,1],
  ['.car-next span',10,15,1],
  ['.car-nav-maneuver strong',12,18,4],
  ['.car-stop-chip',9,13,1],
  ['.mair-stop-primary span',8,11,1],
  ['.car-preview-card b',11,18,2],
  ['.car-stop-row b',10,16,2],
  ['.car-turn-hero h1',14,34,3],
  ['.car-turn-focus header small',10,15,1],
  ['.car-turn-focus header span',9,13,1]
];
let queued=false,observedRoot=null;
function lineCount(el){const cs=getComputedStyle(el),lh=parseFloat(cs.lineHeight)||parseFloat(cs.fontSize)*1.2;return lh>0?Math.ceil(el.scrollHeight/lh):1}
function fit(el,min,max,maxLines){
  if(!el||!el.isConnected)return;
  el.style.fontSize='';
  const base=Math.min(max,parseFloat(getComputedStyle(el).fontSize)||max);
  let size=base,guard=0;
  el.style.fontSize=`${size}px`;
  const tooBig=()=>{
    if(maxLines&&lineCount(el)>maxLines)return true;
    const parent=el.parentElement;
    if(parent&&el.scrollWidth>parent.clientWidth+1)return true;
    return false;
  };
  while(size>min&&guard++<50&&tooBig()){
    size=Math.max(min,size-1);
    el.style.fontSize=`${size}px`;
  }
}
const observer=new MutationObserver(()=>schedule());
function observeRoot(){const root=document.querySelector(ROOT);if(!root||root===observedRoot)return root;if(observedRoot)observer.disconnect();observer.observe(root,{childList:true,subtree:true,characterData:true});observedRoot=root;return root}
function run(){queued=false;const root=observeRoot();if(!root)return;targets.forEach(([sel,min,max,maxLines])=>root.querySelectorAll(sel).forEach(el=>fit(el,min,max,maxLines)))}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(run)}
function boot(){observeRoot();schedule()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.addEventListener('resize',schedule,{passive:true});window.addEventListener('orientationchange',schedule,{passive:true});['jfm:trackchange','jfm:playback-state','mair:journey-context','mair:car-mode'].forEach(n=>window.addEventListener(n,schedule));
window.MAIRCarAutoFit={version:'2026-08-31-v4-clean-nav-four-lines',refresh:schedule};
})();
