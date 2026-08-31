// MAIRFM Car Mode — adaptive text sizing for constrained labels.
(()=>{
'use strict';
if(window.MAIRCarAutoFit)return;
const ROOT='#mairCarWaveOverlay',STYLE_ID='mairCarTextPolish';
const targets=[
  ['.car-track-copy h1',22,42,null],
  ['.car-track-copy p',13,20,null],
  ['.car-next b',11,17,1],
  ['.car-next span',10,15,1],
  ['.car-nav-maneuver strong',11,18,3],
  ['.car-stop-chip',9,13,1],
  ['.mair-stop-primary span',8,11,1],
  ['.car-preview-card b',11,18,2],
  ['.car-stop-row b',10,16,2],
  ['.car-turn-hero h1',14,34,3],
  ['.car-turn-focus header small',10,15,1],
  ['.car-turn-focus header span',9,13,1]
];
let queued=false;
function ensureStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
    #mairCarWaveOverlay .car-nav-card{padding:12px 6px 10px!important;border:0!important;background:transparent!important;box-shadow:none!important;min-width:0}
    #mairCarWaveOverlay .car-nav-maneuver{grid-template-columns:56px minmax(0,1fr)!important;gap:10px!important;margin-top:14px!important;align-items:start!important;min-width:0}
    #mairCarWaveOverlay .car-nav-maneuver>div:last-child{min-width:0}
    #mairCarWaveOverlay .car-nav-arrow{font-size:48px!important;line-height:.95!important}
    #mairCarWaveOverlay .car-nav-maneuver b{font-size:24px!important;line-height:1!important}
    #mairCarWaveOverlay .car-nav-maneuver strong{display:block!important;margin-top:5px!important;line-height:1.06!important;letter-spacing:-.015em;overflow-wrap:anywhere;word-break:normal}
    #mairCarWaveOverlay .car-nav-top{padding:0 2px}
    #mairCarWaveOverlay .car-nav-bottom{margin-top:16px!important;padding:0 2px}
    @media(orientation:landscape) and (max-width:800px){
      #mairCarWaveOverlay .car-nav-maneuver{grid-template-columns:46px minmax(0,1fr)!important;gap:8px!important}
      #mairCarWaveOverlay .car-nav-arrow{font-size:42px!important}
      #mairCarWaveOverlay .car-nav-maneuver b{font-size:21px!important}
    }
  `;
  document.head.appendChild(style);
}
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
function run(){queued=false;ensureStyle();const root=document.querySelector(ROOT);if(!root)return;targets.forEach(([sel,min,max,maxLines])=>root.querySelectorAll(sel).forEach(el=>fit(el,min,max,maxLines)))}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(run)}
const observer=new MutationObserver(schedule);
function boot(){ensureStyle();const root=document.querySelector(ROOT);if(root)observer.observe(root,{childList:true,subtree:true,characterData:true});schedule()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.addEventListener('resize',schedule,{passive:true});window.addEventListener('orientationchange',schedule,{passive:true});['jfm:trackchange','jfm:playback-state','mair:journey-context','mair:car-mode'].forEach(n=>window.addEventListener(n,schedule));
window.MAIRCarAutoFit={version:'2026-08-31-v3-open-nav-text',refresh:schedule};
})();
