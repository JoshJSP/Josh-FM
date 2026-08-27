// MAIR Spotify session UX guard — authentication and playback-device readiness are separate states.
(()=>{
'use strict';
if(window.MAIRSpotifyUXSessionFix?.version)return;
const clone=o=>o&&typeof o==='object'?{...o}:{};
function authState(){
  const auth=window.JFMAuth?.state||{},rel=window.MAIRSpotifySessionReliability?.state||{};
  let storedRefresh=false,storedAccess=false;try{storedRefresh=!!localStorage.getItem('jfm_refresh');storedAccess=!!localStorage.getItem('jfm_token')}catch{}
  const hasRefresh=rel.hasRefreshToken??auth.hasRefreshToken??storedRefresh;
  const hasAccess=rel.hasAccessToken??auth.hasAccessToken??storedAccess;
  const reauthRequired=!!rel.reauthRequired;
  return{hasRefresh:!!hasRefresh,hasAccess:!!hasAccess,reauthRequired,authenticated:!!(hasRefresh||hasAccess)&&!reauthRequired};
}
function fixError(error,auth){
  if(!error)return null;
  const out={...error};
  if(auth.reauthRequired)return{severity:'error',title:'Spotify-sessie verlopen',message:'Spotify heeft de authorisatie ingetrokken of ongeldig verklaard. Koppel Spotify één keer opnieuw.',primaryAction:'reconnect',secondaryAction:'diagnostics',diagnosticsCode:'SPOTIFY_REAUTH_REQUIRED',autoDismiss:false};
  if(out.diagnosticsCode==='SPOTIFY_DEVICE')return{...out,message:'MAIR is nog gekoppeld met Spotify en probeert het afspeelapparaat opnieuw klaar te zetten.',primaryAction:'device',secondaryAction:'diagnostics'};
  if(out.diagnosticsCode==='PLAYBACK_STOPPED')return{...out,message:'Je Spotify-koppeling is nog geldig. MAIR probeert de muziekverbinding te herstellen.',primaryAction:'resume',secondaryAction:'diagnostics'};
  if(out.diagnosticsCode==='SPOTIFY_CONNECT'&&auth.authenticated)return{...out,title:'Spotify tijdelijk niet bereikbaar',message:'Je Spotify-koppeling blijft bewaard. MAIR probeert automatisch opnieuw verbinding te maken.',primaryAction:null,secondaryAction:'diagnostics',autoDismiss:true};
  if(out.diagnosticsCode==='SPOTIFY_PREMIUM')return{...out,primaryAction:'diagnostics',secondaryAction:null};
  return out;
}
function fixState(input){
  const state=clone(input),auth=authState(),connection=clone(state.spotifyConnection),playback=clone(state.playbackState);
  if(auth.authenticated){
    const deviceReady=!!(window.JFMSpotifySDK?.deviceId||window.JFMPlayback?.state?.deviceId||window.JFMPlaybackState?.get?.()?.deviceId);
    connection.connected=true;connection.connecting=false;connection.label=deviceReady?'Verbonden':'Verbonden · apparaat herstellen';
    if(state.appState==='DISCONNECTED'||state.appState==='CONNECTING')state.appState=playback.isPlaying?'PLAYING':state.track?'PAUSED':'RECOVERING';
  }else if(auth.reauthRequired){connection.connected=false;connection.connecting=false;connection.label='Opnieuw koppelen nodig'}
  state.spotifyConnection=connection;state.recoverableError=fixError(state.recoverableError,auth);state.spotifySession={...auth};
  return state;
}
function renderFixed(state){try{window.MAIRUX?.render?.(fixState(state))}catch{}}
function sync(){const get=window.MAIRUXState?.get;if(typeof get==='function')renderFixed(get())}
window.addEventListener('mair:ux-state',e=>setTimeout(()=>renderFixed(e.detail?.state||{}),0));
window.addEventListener('mair:spotify-device-recovered',()=>setTimeout(sync,0));
window.addEventListener('pageshow',()=>setTimeout(sync,120));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(sync,120)});
const install=()=>{if(!window.MAIRUXState?.get||!window.MAIRUX?.render)return false;if(!window.MAIRUXState.__spotifySessionFixed){const original=window.MAIRUXState.get.bind(window.MAIRUXState);window.MAIRUXState.get=()=>fixState(original());window.MAIRUXState.__spotifySessionFixed=true}sync();return true};
if(!install()){let tries=0;const timer=setInterval(()=>{if(install()||++tries>30)clearInterval(timer)},100)}
window.MAIRSpotifyUXSessionFix={version:'spotify-session-ux-v1',authState,fixState,sync};
window.MAIRRuntime?.register?.('mair-spotify-ux-session-fix',{version:'v1',owner:'spotify-session-presentation'});
})();
