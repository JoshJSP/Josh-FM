// MAIRFM Car Mode — keep the options menu open while the live UI rerenders.
(()=>{
'use strict';
if(window.MAIRCarMenuSticky)return;
let wanted=false,restoring=false;
const root=()=>document.getElementById('mairCarWaveOverlay');
const menuHtml=()=>window.MAIRCarModePrototype?.menuHtml?.()||'';
function restore(){if(!wanted||restoring)return;const r=root();if(!r||r.querySelector('.car-menu-backdrop'))return;restoring=true;r.insertAdjacentHTML('beforeend',menuHtml());requestAnimationFrame(()=>{restoring=false})}
document.addEventListener('click',e=>{
  const r=root();if(!r||!r.contains(e.target))return;
  const act=e.target.closest('[data-act]')?.dataset.act;
  if(act==='menu'){wanted=true;setTimeout(restore,0);return}
  if(act==='menuclose'||act==='close'||act==='search'||act==='addstop'||act==='music'||act==='time'||act==='waze'||act==='vibe'||act==='placehere'){wanted=false;return}
  if(e.target.classList?.contains('car-menu-backdrop'))wanted=false;
},true);
const obs=new MutationObserver(()=>{if(wanted)restore();else if(!root()?.querySelector('.car-menu-backdrop'))wanted=false});
function boot(){const r=root();if(r)obs.observe(r,{childList:true,subtree:false});else setTimeout(boot,500)}
window.addEventListener('mair:car-mode',e=>{if(!e.detail?.open)wanted=false});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.MAIRCarMenuSticky={version:'2026-08-31-v1',isOpen:()=>wanted,close:()=>{wanted=false;root()?.querySelector('.car-menu-backdrop')?.remove()}};
})();
