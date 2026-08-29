// MAIR DJ retirement layer — keeps the complete DJ stack available in backoffice, but removes it from the public listening experience.
(()=>{
'use strict';
if(window.MAIRDJRetired)return;
const KEY='mair_dj_backoffice_v1';
const now=()=>Date.now();
const readJson=(key,fallback=null)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}};
function snapshot(reason='boot'){
  const dj=window.MAIRDJ;
  const profiles=window.MAIRDJProfiles;
  let diagnostics=null;
  try{diagnostics=dj?.diagnostics?.()||dj?.state?.()||null}catch{}
  const data={
    retired:true,
    publicEnabled:false,
    reason,
    savedAt:now(),
    activeProfileId:localStorage.getItem('mair_dj_profile_v1')||'josh',
    profiles:profiles?.profiles||window.MAIRCurrentDJ||null,
    talk:Number(document.getElementById('talk')?.value||0),
    facts:document.getElementById('facts')?.checked??true,
    timeMention:document.getElementById('timeMention')?.checked??true,
    weatherMention:document.getElementById('weatherMention')?.checked??false,
    jingles:document.getElementById('jingles')?.checked??true,
    voiceMode:document.getElementById('voiceMode')?.value||'fish',
    diagnostics,
    memory:readJson('mair_dj_memory_v1',null),
    directorMemory:readJson('jfm_director_memory_v1',null)
  };
  try{localStorage.setItem(KEY,JSON.stringify(data))}catch{}
  return data;
}
function stopDj(reason='public-dj-retired'){
  const dj=window.MAIRDJ;
  try{dj?.cancelActive?.(reason)}catch{}
  try{dj?.skipNext?.()}catch{}
  try{window.JFMDJAudio?.stop?.()}catch{}
  try{window.JFMDJAudio?.cancel?.()}catch{}
}
function hideCardFor(id){
  const el=document.getElementById(id);if(!el)return;
  const card=el.closest('article.card');if(card)card.hidden=true;
}
function removePublicDjUi(){
  const styleId='mair-dj-retired-style';
  if(!document.getElementById(styleId)){
    const style=document.createElement('style');style.id=styleId;
    style.textContent='#djNow,#skipTalk,#mairDJProfiles,#mairDJSheet{display:none!important}[data-mair-dj]{display:none!important}.mair-dj-card-v2{display:none!important}';
    document.head.appendChild(style);
  }
  document.getElementById('djNow')?.closest('.grid2')?.setAttribute('hidden','');
  hideCardFor('djText');
  hideCardFor('talk');
  hideCardFor('voiceMode');
  document.getElementById('mairDJProfiles')?.remove();
  document.getElementById('mairDJSheet')?.remove();
}
function disableEntryPoints(){
  const dj=window.MAIRDJ;if(!dj)return;
  const disabled=async()=>false;
  ['playNow','armNow','trigger','prepare','run','speak','breakNow','forceBreak','scheduleNow'].forEach(name=>{try{if(typeof dj[name]==='function')dj[name]=disabled}catch{}});
  try{if(typeof dj.skipNext==='function')dj.skipNext()}catch{}
}
function install(){
  snapshot('retired-install');
  stopDj();
  disableEntryPoints();
  removePublicDjUi();
  document.documentElement.dataset.mairDj='retired';
  try{localStorage.setItem('mair_dj_public_enabled_v1','0')}catch{}
  window.MAIRDJBackoffice={
    version:'mair-dj-backoffice-v1',
    retired:true,
    get snapshot(){return snapshot('backoffice-read')},
    refresh:()=>snapshot('manual-refresh'),
    storageKey:KEY
  };
  window.MAIRDJRetired={version:'mair-dj-retired-v1',install,snapshot,stop:stopDj};
  try{window.dispatchEvent(new CustomEvent('mair:dj-retired',{detail:{publicEnabled:false}}))}catch{}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
window.addEventListener('mair:foundation-ready',()=>setTimeout(install,0));
window.addEventListener('mair:dj-v2-state',()=>{if(document.documentElement.dataset.mairDj==='retired')stopDj('dj-state-after-retirement')});
})();
