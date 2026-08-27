// MAIR reliability hotfix — keep Spotify auth separate from Web Playback device health
// and surface the real DJ schedule state again in the public radio UI.
(()=>{
'use strict';
if(window.MAIRReliabilityHotfix)return;
const DEVICE_KEY='jfm_spotify_device_id';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let repairPromise=null,lastRepairAt=0,lastRepairReason='',lastRepairError='',repairSuccesses=0,repairFailures=0,lastDjNudgeAt=0,statusObserver=null;

function authState(){try{return window.JFMAuth?.state||{}}catch{return{}}}
function authConnected(){const s=authState();return !!(s.hasRefreshToken||s.hasAccessToken||localStorage.getItem('jfm_refresh')||localStorage.getItem('jfm_token'))}
function currentTrackId(){try{return String(window.JFMPlaybackState?.get?.()?.trackId||'')}catch{return''}}
function playing(){try{return !!window.JFMPlaybackState?.get?.()?.isPlaying}catch{return false}}
function runtimeRecord(type,detail={},level='info'){try{window.MAIRRuntime?.record?.(type,detail,level)}catch{}}
function emit(type,detail={}){try{window.dispatchEvent(new CustomEvent(type,{detail}))}catch{}}

function syncAuthPresentation(){
  if(!authConnected())return false;
  const status=document.getElementById('status');
  if(status&&!status.classList.contains('on')){
    status.classList.add('on');status.classList.remove('off');
    if(/offline|niet verbonden|koppel/i.test(status.textContent||''))status.textContent='Spotify gekoppeld · apparaat herstellen…';
  }
  document.getElementById('setup')?.classList.add('hidden');
  document.getElementById('logout')?.classList.remove('hidden');
  document.querySelectorAll('[data-mairfm-error-action="reconnect"]').forEach(b=>{if(b.textContent!=='Verbinding herstellen')b.textContent='Verbinding herstellen'});
  return true
}

async function repairDevice(reason='automatic'){
  if(!authConnected())return false;
  if(repairPromise)return repairPromise;
  const now=Date.now();
  if(now-lastRepairAt<2200)return false;
  lastRepairAt=now;lastRepairReason=String(reason||'automatic');lastRepairError='';
  repairPromise=(async()=>{
    runtimeRecord('reliability.device-repair-start',{reason:lastRepairReason});
    syncAuthPresentation();
    try{
      const access=await window.JFMAuth?.ensure?.();
      if(!access&&typeof window.ensure==='function'){const fallback=await window.ensure();if(!fallback)throw Error('Spotify-auth is niet beschikbaar')}
      if(!authConnected())return false;
      const sdk=window.JFMSpotifySDK;
      if(!sdk)throw Error('Spotify Web Playback SDK wordt nog geladen');
      // A persisted Web Playback device id is never authoritative across runtimes.
      if(!sdk.deviceId)try{localStorage.removeItem(DEVICE_KEY)}catch{}
      let id='';
      try{id=String(await sdk.ensureDevice?.()||'')}catch{}
      if(!id){try{id=String(await sdk.reconnect?.()||'')}catch{}}
      if(!id)throw Error('Spotify Web Playback device kon nog niet worden geregistreerd');
      try{localStorage.setItem(DEVICE_KEY,id)}catch{}
      syncAuthPresentation();
      const truth=window.JFMPlaybackState?.get?.()||{};
      if(truth.expectedLive&&!truth.isPlaying)await window.JFMPlayback?.recover?.(`reliability-${lastRepairReason}`);
      repairSuccesses++;lastRepairError='';
      runtimeRecord('reliability.device-repair-pass',{reason:lastRepairReason,deviceId:id});
      emit('mair:spotify-device-recovered',{reason:lastRepairReason,deviceId:id});
      setTimeout(()=>recoverDjPlanning('device-recovered'),700);
      return true
    }catch(e){
      lastRepairError=String(e?.message||e||'device repair failed').slice(0,240);repairFailures++;
      runtimeRecord('reliability.device-repair-fail',{reason:lastRepairReason,error:lastRepairError},'warn');
      // Never convert a recoverable device failure into OAuth. A definitive invalid_grant
      // is handled by the hardened auth layer, which clears the refresh credential.
      if(authConnected())syncAuthPresentation();
      return false
    }
  })().finally(()=>{repairPromise=null});
  return repairPromise
}

function djState(){try{return window.MAIRDJ?.diagnostics?.()||window.MAIRDJ?.state?.()||null}catch{return null}}
function djCopy(d={}){
  const phase=String(d.phase||'COUNTING').toUpperCase(),remaining=Math.max(0,Number(d.remaining)||0),recentMiss=Number(d.lastMissAt||0)>Date.now()-30000?String(d.lastMissReason||''):'';
  if(phase==='SPEAKING')return{state:'ON_AIR',label:'DJ · On air',detail:'MAIRFM DJ is live.'};
  if(phase==='HANDOFF'||phase==='RESTORING')return{state:'PREPARING',label:'DJ · On air voorbereiden',detail:'Muziek en DJ worden veilig overgedragen.'};
  if(phase==='ARMED')return{state:'PREPARING',label:'DJ · Zo op de radio',detail:'De break staat klaar voor de volgende natuurlijke overgang.'};
  if(phase==='PREPARING')return{state:'PREPARING',label:'DJ · Break wordt voorbereid',detail:'De DJ maakt het volgende radiomoment klaar.'};
  if(recentMiss&&/playback|spotify|device|transition|prepare|break-missed|air-failed|rebase/i.test(recentMiss))return{state:'RECOVERING',label:'DJ · Probeert opnieuw',detail:'De DJ-planning herstelt automatisch zodra playback stabiel is.'};
  if(d.skipNextBreak)return{state:'QUIET',label:'DJ · Even stil',detail:'Het volgende radiomoment wordt overgeslagen.'};
  if(remaining<=0)return{state:'QUIET',label:'DJ · Radiomoment wordt bepaald',detail:'Vanaf de volgende natuurlijke overgang kan de DJ komen.'};
  if(remaining===1)return{state:'QUIET',label:'DJ · Radiomoment komt dichtbij',detail:'Nog ongeveer 1 nummer tot een mogelijk DJ-moment.'};
  return{state:'QUIET',label:'DJ · Luistert mee',detail:`Nog ongeveer ${remaining} nummers tot een mogelijk DJ-moment.`}
}
function renderDj(d=djState()){
  if(!d)return;
  const copy=djCopy(d);
  // Run after the normal UX renderer so authoritative runtime state wins over generic copy.
  setTimeout(()=>{
    const card=document.getElementById('mairfmDjPublic'),label=document.getElementById('mairfmDjLabel'),detail=document.getElementById('mairfmDjDetail');
    if(card)card.dataset.state=copy.state;
    if(label&&label.textContent!==copy.label)label.textContent=copy.label;
    if(detail&&detail.textContent!==copy.detail)detail.textContent=copy.detail;
  },0)
}

async function recoverDjPlanning(reason='watchdog'){
  const dj=window.MAIRDJ,d=djState(),trackId=currentTrackId();
  if(!dj||!d||!trackId||!playing()||dj.busy)return false;
  if(['PREPARING','ARMED','HANDOFF','SPEAKING','RESTORING'].includes(String(d.phase||'').toUpperCase())||d.prepared)return false;
  const recentMiss=Number(d.lastMissAt||0)>Date.now()-45000?String(d.lastMissReason||''):'';
  if(!recentMiss||!/natural-transition-error|break-missed|prepare-failed|air-failed|rebase|playback|spotify|device|transition/i.test(recentMiss))return false;
  if(Number(d.remaining)>1)return false;
  if(Date.now()-lastDjNudgeAt<9000)return false;
  lastDjNudgeAt=Date.now();
  runtimeRecord('reliability.dj-plan-recovery',{reason,trackId,remaining:Number(d.remaining)||0,lastMissReason:recentMiss},'warn');
  try{return !!(await dj.prepare?.({manual:false,originTrackId:trackId}))}catch{return false}
}

function interceptRecoveryActions(){
  document.addEventListener('click',e=>{
    const button=e.target?.closest?.('[data-mairfm-error-action]');if(!button)return;
    const action=String(button.dataset.mairfmErrorAction||'');
    if(!['device','reconnect'].includes(action)||!authConnected())return;
    e.preventDefault();e.stopImmediatePropagation();
    button.disabled=true;button.textContent='Verbinding herstellen…';
    repairDevice(`ui-${action}`).finally(()=>{button.disabled=false;button.textContent='Verbinding herstellen'});
  },true)
}

function installObservers(){
  if(statusObserver)return;
  statusObserver=new MutationObserver(()=>{syncAuthPresentation();renderDj()});
  statusObserver.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
}
function foregroundRepair(reason){
  syncAuthPresentation();renderDj();
  if(!authConnected())return;
  const sdk=window.JFMSpotifySDK;
  if(sdk&&!sdk.deviceId)setTimeout(()=>repairDevice(reason),250);
  setTimeout(()=>recoverDjPlanning(reason),900)
}

interceptRecoveryActions();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{installObservers();foregroundRepair('dom-ready')},{once:true});else{installObservers();foregroundRepair('boot')}
window.addEventListener('mair:dj-v2-state',e=>renderDj(e.detail||{}));
window.addEventListener('mair:ux-state',()=>renderDj());
window.addEventListener('mair:user-error',e=>{const error=String(e.detail?.error||'');if(authConnected()&&/device|apparaat|not.?ready|geen actief/i.test(error))setTimeout(()=>repairDevice('device-error'),150)});
window.addEventListener('mair:spotify-device-recovered',()=>setTimeout(()=>recoverDjPlanning('device-recovered-event'),600));
window.addEventListener('pageshow',()=>setTimeout(()=>foregroundRepair('pageshow'),300));
window.addEventListener('online',()=>setTimeout(()=>foregroundRepair('online'),300));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(()=>foregroundRepair('visible'),300)});
setInterval(()=>{syncAuthPresentation();renderDj();recoverDjPlanning('watchdog')},5000);

window.MAIRReliabilityHotfix={
  version:'mair-reliability-v1',repairDevice,recoverDjPlanning,renderDj,syncAuthPresentation,authConnected,
  get state(){return{authConnected:authConnected(),repairing:!!repairPromise,lastRepairAt,lastRepairReason,lastRepairError,repairSuccesses,repairFailures,lastDjNudgeAt,dj:djState()}}
};
runtimeRecord('reliability.hotfix-installed',{version:'mair-reliability-v1'});
})();
