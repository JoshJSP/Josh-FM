// MAIR retired-features layer — preserves DJ + Personal Top 40 state for backoffice while removing them from the public app.
(()=>{
'use strict';
if(window.MAIRDJRetired)return;
const DJ_KEY='mair_dj_backoffice_v1',TOP40_KEY='mair_top40_backoffice_v1';
const now=()=>Date.now();
const readJson=(key,fallback=null)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}};
function djSnapshot(reason='boot'){
  const dj=window.MAIRDJ,profiles=window.MAIRDJProfiles;
  let diagnostics=null;try{diagnostics=dj?.diagnostics?.()||dj?.state?.()||null}catch{}
  const data={retired:true,publicEnabled:false,reason,savedAt:now(),activeProfileId:localStorage.getItem('mair_dj_profile_v1')||'josh',profiles:profiles?.profiles||window.MAIRCurrentDJ||null,talk:Number(document.getElementById('talk')?.value||0),facts:document.getElementById('facts')?.checked??true,timeMention:document.getElementById('timeMention')?.checked??true,weatherMention:document.getElementById('weatherMention')?.checked??false,jingles:document.getElementById('jingles')?.checked??true,voiceMode:document.getElementById('voiceMode')?.value||'fish',diagnostics,memory:readJson('mair_dj_memory_v1',null),directorMemory:readJson('jfm_director_memory_v1',null)};
  try{localStorage.setItem(DJ_KEY,JSON.stringify(data))}catch{}return data;
}
function top40Snapshot(reason='boot'){
  const data={retired:true,publicEnabled:false,reason,savedAt:now(),telemetry:readJson('jfm_top40_telemetry_v1',{}),ranks:readJson('jfm_top40_snapshot_v1',{})};
  try{localStorage.setItem(TOP40_KEY,JSON.stringify(data))}catch{}return data;
}
function stopDj(reason='public-dj-retired'){
  const dj=window.MAIRDJ;
  try{dj?.cancelActive?.(reason)}catch{}
  try{dj?.skipNext?.()}catch{}
  try{window.JFMDJAudio?.stop?.()}catch{}
  try{window.JFMDJAudio?.cancel?.()}catch{}
}
function hideCardFor(id){const el=document.getElementById(id);if(!el)return;const card=el.closest('article.card');if(card)card.hidden=true}
function removePublicUi(){
  const styleId='mair-retired-features-style';
  if(!document.getElementById(styleId)){
    const style=document.createElement('style');style.id=styleId;
    style.textContent='#djNow,#skipTalk,#mairDJProfiles,#mairDJSheet,#jfmTop40Card,#jfmTop40Settings,#clearTop40{display:none!important}[data-mair-dj]{display:none!important}.mair-dj-card-v2{display:none!important}';
    document.head.appendChild(style);
  }
  document.getElementById('djNow')?.closest('.grid2')?.setAttribute('hidden','');
  hideCardFor('djText');hideCardFor('talk');hideCardFor('voiceMode');
  ['mairDJProfiles','mairDJSheet','jfmTop40Card','jfmTop40Settings'].forEach(id=>document.getElementById(id)?.remove());
}
function disableDjEntryPoints(){
  const dj=window.MAIRDJ;if(!dj)return;
  const disabled=async()=>false;
  ['playNow','armNow','trigger','prepare','run','speak','breakNow','forceBreak','scheduleNow'].forEach(name=>{try{if(typeof dj[name]==='function')dj[name]=disabled}catch{}});
  try{if(typeof dj.skipNext==='function')dj.skipNext()}catch{}
}
function disableTop40PublicApi(){
  const api=window.JFMTop40;if(!api)return;
  try{api.render=()=>false}catch{}
  try{api.publicEnabled=false}catch{}
}
function install(){
  djSnapshot('retired-install');top40Snapshot('retired-install');stopDj();disableDjEntryPoints();disableTop40PublicApi();removePublicUi();
  document.documentElement.dataset.mairDj='retired';document.documentElement.dataset.mairPersonalTop40='retired';
  try{localStorage.setItem('mair_dj_public_enabled_v1','0');localStorage.setItem('mair_personal_top40_public_enabled_v1','0')}catch{}
  window.MAIRDJBackoffice={version:'mair-dj-backoffice-v1',retired:true,get snapshot(){return djSnapshot('backoffice-read')},refresh:()=>djSnapshot('manual-refresh'),storageKey:DJ_KEY};
  window.MAIRTop40Backoffice={version:'mair-top40-backoffice-v1',retired:true,get snapshot(){return top40Snapshot('backoffice-read')},refresh:()=>top40Snapshot('manual-refresh'),storageKey:TOP40_KEY};
  window.MAIRDJRetired={version:'mair-retired-features-v2',install,djSnapshot,top40Snapshot,stop:stopDj};
  try{window.dispatchEvent(new CustomEvent('mair:features-retired',{detail:{dj:false,personalTop40:false}}))}catch{}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
window.addEventListener('mair:foundation-ready',()=>setTimeout(install,0));
window.addEventListener('mair:dj-v2-state',()=>{if(document.documentElement.dataset.mairDj==='retired'){disableDjEntryPoints();stopDj('dj-state-after-retirement')}});
window.addEventListener('jfm:trackchange',()=>{if(document.documentElement.dataset.mairPersonalTop40==='retired')setTimeout(()=>{top40Snapshot('trackchange');removePublicUi()},0)});
setInterval(()=>{if(document.documentElement.dataset.mairDj==='retired'){disableDjEntryPoints();removePublicUi()}if(document.documentElement.dataset.mairPersonalTop40==='retired'){disableTop40PublicApi();removePublicUi()}},3000);
})();
