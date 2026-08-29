// MAIRFM Sleep — landscape presentation adapter.
// This file only applies CSS classes to the existing mair-sleep.js overlay.
// It does not schedule, cancel, pause or otherwise own sleep/playback behavior.
(()=>{
'use strict';
if(window.MAIRSleepLandscapePrototype)return;

const media=window.matchMedia('(orientation: landscape) and (min-width: 700px)');
let enabled=true;
let lastApplied=false;

function overlay(){return document.getElementById('mairSleepOverlay')}

function sync(){
  const node=overlay();
  if(!node)return false;
  const shouldApply=enabled&&media.matches;
  node.classList.toggle('mair-sleep-landscape-v2',shouldApply);
  node.dataset.sleepLayout=shouldApply?'landscape-bedside':'default';
  lastApplied=shouldApply;
  try{window.dispatchEvent(new CustomEvent('mair:sleep-layout',{detail:{layout:node.dataset.sleepLayout,active:shouldApply}}))}catch{}
  return shouldApply;
}

function setEnabled(value){
  enabled=!!value;
  sync();
  return status();
}

function status(){
  return {
    version:'landscape-bedside-2026-08-29',
    enabled,
    matches:media.matches,
    applied:lastApplied,
    sleepAvailable:!!window.MAIRSleep,
    overlayAvailable:!!overlay()
  };
}

function boot(){
  sync();
  media.addEventListener?.('change',sync);
  window.addEventListener('resize',sync,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(sync,80),{passive:true});
  window.addEventListener('mair:sleep',sync);
  window.addEventListener('mair:foundation-ready',sync);

  // mair-sleep.js may inject its overlay after this adapter loads.
  const observer=new MutationObserver(()=>{
    if(overlay()){sync();observer.disconnect()}
  });
  if(!overlay())observer.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(sync,250);
  setTimeout(sync,1200);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();

window.MAIRSleepLandscapePrototype={
  version:'landscape-bedside-2026-08-29',
  enable:()=>setEnabled(true),
  disable:()=>setEnabled(false),
  sync,
  status
};
})();
