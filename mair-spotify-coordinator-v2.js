// MAIR Spotify recovery coordinator v2 — auth, device readiness and playback recovery stay separate.
(()=>{
'use strict';
if(window.MAIRSpotifyCoordinator?.version)return;
const DEVICE_KEY='jfm_spotify_device_id';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let patched=false,recovering=false,lastError='',lastReason='',lastSuccessAt=0,lastAttemptAt=0,automaticFailures=0;

function authState(){
  const rel=window.MAIRSpotifySessionReliability?.state||{},auth=window.JFMAuth?.state||{};
  let storedRefresh=false,storedAccess=false;
  try{storedRefresh=!!localStorage.getItem('jfm_refresh');storedAccess=!!localStorage.getItem('jfm_token')}catch{}
  const hasRefresh=rel.hasRefreshToken??auth.hasRefreshToken??storedRefresh;
  const hasAccess=rel.hasAccessToken??auth.hasAccessToken??storedAccess;
  const reauthRequired=!!rel.reauthRequired;
  return{hasRefreshToken:!!hasRefresh,hasAccessToken:!!hasAccess,reauthRequired,authenticated:!!(hasRefresh||hasAccess)&&!reauthRequired};
}
function sdk(){return window.JFMSpotifySDK||null}
function playback(){return window.JFMPlayback||null}
function truth(){try{return window.JFMPlaybackState?.get?.()||{}}catch{return{}}}
function deviceId(){return String(sdk()?.deviceId||'').trim()}
function activate(){try{sdk()?.player?.activateElement?.()}catch{}try{window.jfmSpotifyPlayer?.activateElement?.()}catch{}}
function controls(on=true){for(const id of ['start','play','prev','next','djNow','skipTalk','searchBtn','rebuild']){const el=document.getElementById(id);if(el)el.disabled=!on}}
function clearErrors(reason='spotify-recovered'){
  lastError='';automaticFailures=0;
  try{window.JFMPlaybackState?.patch?.({lastError:''},reason)}catch{}
  try{window.MAIRUXState?.refresh?.(reason)}catch{}
}
function publish(type,extra={}){
  const detail={type,at:Date.now(),reason:lastReason,deviceId:deviceId(),auth:authState(),recovering,lastError,...extra};
  try{window.dispatchEvent(new CustomEvent('mair:spotify-coordinator',{detail}))}catch{}
  return detail
}
function success(reason='recovered',extra={}){
  lastReason=reason;lastSuccessAt=Date.now();lastError='';controls(true);clearErrors('spotify-recovery-success');
  try{window.dispatchEvent(new CustomEvent('mair:spotify-device-recovered',{detail:{reason,deviceId:deviceId(),at:lastSuccessAt,...extra}}))}catch{}
  publish('ready',extra);return true
}
function failure(reason,error,{automatic=false}={}){
  lastReason=reason;lastError=String(error?.message||error||'Spotify herstel mislukt').slice(0,240);if(automatic)automaticFailures++;
  publish('recovery-failed',{automatic});try{window.MAIRUXState?.refresh?.('spotify-recovery-failed')}catch{};return false
}
async function ensureAuthorized(){
  const before=authState();if(before.reauthRequired)return false;
  const fn=window.JFMAuth?.ensure||window.MAIRSpotifySessionReliability?.ensure;
  if(typeof fn!=='function')return before.authenticated;
  try{const token=await fn();return !!token||authState().authenticated}catch(e){if(e?.code==='AUTH_REAUTH_REQUIRED')return false;throw e}
}
async function ensureDevice({reason='device',userGesture=false}={}){
  if(userGesture)activate();lastReason=reason;lastAttemptAt=Date.now();
  if(!(await ensureAuthorized())){const e=Error('Spotify-authorisatie is niet meer geldig.');e.code='AUTH_REAUTH_REQUIRED';throw e}
  const s=sdk();if(!s?.ensureDevice)throw Error('Spotify Web Playback is nog niet geladen.');
  try{localStorage.removeItem(DEVICE_KEY)}catch{}
  let id=String(await s.ensureDevice()||s.deviceId||'').trim();
  if(!id&&s.reconnect)id=String(await s.reconnect()||s.deviceId||'').trim();
  if(!id)throw Error('Spotify-apparaat kon niet opnieuw worden geregistreerd.');
  try{localStorage.setItem(DEVICE_KEY,id)}catch{}
  controls(true);return id
}
async function verifyLive(id,tries=7){
  if(typeof window.api!=='function')return null;
  for(let i=0;i<tries;i++){
    try{const state=await window.api('/me/player');if(state?.device?.id===id&&state?.is_playing&&state?.item)return state}catch{}
    await wait(120+i*70)
  }
  return null
}
async function recoverFromGesture(reason='user'){activate();return recover(reason,{userGesture:true,force:true})}
async function recover(reason='automatic',{userGesture=false,force=false}={}){
  const a=authState();if(!a.authenticated&&a.reauthRequired)return failure(reason,'Spotify-sessie verlopen',{automatic:!userGesture});
  if(recovering)return false;
  if(!force&&!userGesture&&Date.now()-lastAttemptAt<2200)return false;
  recovering=true;lastReason=reason;lastAttemptAt=Date.now();publish('recovering',{userGesture});
  try{
    if(userGesture)activate();
    const id=await ensureDevice({reason,userGesture});
    const p=playback();if(!p)throw Error('MAIR playback-controller is nog niet geladen.');
    let ok=false;
    if(p.health?.reloadNeedsGesture){
      if(!userGesture)return false;
      activate();ok=!!(await p.__mairCoordinatorOriginal?.playPause?.())
    }else{
      ok=!!(await p.__mairCoordinatorOriginal?.recover?.(`coordinator:${reason}`));
      if(!ok&&userGesture){
        const t=truth();activate();
        if(t.trackId||window.playback?.item)ok=!!(await p.__mairCoordinatorOriginal?.resume?.());
        else ok=!!(await p.__mairCoordinatorOriginal?.start?.())
      }
    }
    const live=await verifyLive(id,4);
    if(live){try{window.JFMPlaybackState?.ingest?.(live,'spotify-coordinator')}catch{};ok=true}
    if(ok)return success(reason,{userGesture});
    return failure(reason,'Spotify bevestigde nog geen hoorbare playback.',{automatic:!userGesture})
  }catch(e){
    if(e?.code==='AUTH_REAUTH_REQUIRED')return failure(reason,e,{automatic:!userGesture});
    return failure(reason,e,{automatic:!userGesture})
  }finally{recovering=false;publish('settled',{userGesture})}
}
function patchPlayback(){
  const p=playback();if(!p||p.__mairCoordinatorPatched)return false;
  const original={ensureDevice:typeof p.ensureDevice==='function'?p.ensureDevice.bind(p):null,recover:typeof p.recover==='function'?p.recover.bind(p):null,playPause:typeof p.playPause==='function'?p.playPause.bind(p):null,resume:typeof p.resume==='function'?p.resume.bind(p):null,start:typeof p.start==='function'?p.start.bind(p):null};
  Object.defineProperty(p,'__mairCoordinatorOriginal',{value:original,configurable:false,enumerable:false,writable:false});
  p.ensureDevice=function(){activate();return ensureDevice({reason:'ui-device',userGesture:true}).then(id=>{success('ui-device-ready');return id})};
  p.recover=function(reason='watchdog'){
    if(reason==='ux-device'||reason==='ux-resume'||reason==='gesture')return recoverFromGesture(reason);
    return original.recover?original.recover(reason):false
  };
  p.resumeFromGesture=(reason='ui-resume')=>recoverFromGesture(reason);
  p.__mairCoordinatorPatched=true;patched=true;return true
}
function install(){if(patchPlayback())publish('installed');return patched}
async function automatic(reason='automatic'){
  install();const a=authState(),t=truth();if(document.visibilityState==='hidden'||!a.authenticated||a.reauthRequired||!t.expectedLive)return false;
  if(deviceId()&&t.isPlaying){clearErrors('spotify-already-live');return true}
  return recover(reason,{userGesture:false})
}
window.addEventListener('mair:spotify-device-recovered',()=>{controls(true);clearErrors('spotify-device-ready')});
window.addEventListener('jfm:playback-state',e=>{const s=e.detail?.state||{};if(s.isPlaying){controls(true);clearErrors('spotify-playing-confirmed')}});
window.addEventListener('pageshow',()=>setTimeout(()=>automatic('pageshow').catch(()=>false),650));
window.addEventListener('online',()=>setTimeout(()=>automatic('online').catch(()=>false),650));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(()=>automatic('visible').catch(()=>false),650)});
let tries=0;const timer=setInterval(()=>{if(install()||++tries>80)clearInterval(timer)},100);
setInterval(()=>automatic('watchdog').catch(()=>false),15000);
install();
window.MAIRSpotifyCoordinator={version:'spotify-coordinator-v2',authState,ensureAuthorized,ensureDevice,recover,recoverFromGesture,install,get state(){return{...authState(),deviceId:deviceId(),recovering,patched,lastError,lastReason,lastSuccessAt,lastAttemptAt,automaticFailures}}};
window.MAIRRuntime?.register?.('mair-spotify-coordinator',{version:'v2',owner:'spotify-session-device-recovery'});
})();
