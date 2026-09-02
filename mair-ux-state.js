// MAIRFM 1.0 semantic public UI state. Technical detail remains in Diagnostics.
(()=>{
'use strict';
if(window.MAIRUXState?.version)return;
const listeners=new Set(),$=id=>document.getElementById(id);
let stationFeedback='',stationFeedbackAt=0,lastStationError='',lastStationErrorAt=0,lastRecoverySuccess=0,lastUserError=null;
const LABELS={hits:'Hits',top40:'Top 40',new:'Discovery',nl:'Nederlandstalig',party:'Party',chill:'Chill',summer:'Summer',throwback:'Throwback','00s':'00s','10s':'10s',mix:'Your Mix'};
const clean=(v,n=220)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,n);
function playback(){try{return window.JFMPlaybackState?.get?.()||window.JFMPlayback?.state||null}catch{return null}}
function dj(){try{return window.MAIRDJ?.diagnostics?.()||window.JFMDJAuthoritative?.diagnostics?.()||null}catch{return null}}
function currentTrack(){const item=window.playback?.item||null,p=playback();if(!item&&!p?.trackId)return null;return{id:clean(item?.id||p?.trackId,120),name:clean(item?.name||$('title')?.textContent||'',180),artists:(item?.artists||[]).map(x=>clean(x?.name||x,100)).filter(Boolean),image:item?.album?.images?.[0]?.url||$('artImg')?.src||'',durationMs:Number(item?.duration_ms||p?.durationMs||0)}}
function nextTrack(){const item=window.__jfmSpotifyUpcomingTruth?.items?.[0]||window.JFMStationHealth?.snapshot?.()?.nextTrack||null;if(!item)return null;return{id:clean(item.id,120),name:clean(item.name,180),artists:(item.artists||[]).map(x=>clean(x?.name||x,100)).filter(Boolean),image:item.album?.images?.[0]?.url||item.image||'',request:!!item.request}}
// De verbindingsstatus hing aan de CSS-klasse van de statuspil. stability-core haalt
// die klasse er bij elke voorbijgaande hapering af - een trage tokenvernieuwing, een
// not_ready van de SDK, een mislukte reconcile - en dan viel de hele app terug op
// DISCONNECTED: koppelscherm zichtbaar, 'Verbind Spotify om te beginnen' in beeld.
// Dat is wat er bij openen, tijdens luisteren en bij schermwisselingen gebeurde.
// De sessie zelf is de waarheid: een geldig refresh token betekent verbonden, ook als
// het Spotify-device even weg is. Alleen een definitieve invalid_grant of een compleet
// lege sessie telt als niet verbonden.
function sessionAlive(){
  try{
    const hardened=window.MAIRSpotifySessionReliability?.state;
    if(hardened&&hardened.reauthRequired===true)return false;
    const auth=window.JFMAuth?.state;
    if(auth&&(typeof auth.hasAccessToken==='boolean'||typeof auth.hasRefreshToken==='boolean'))return !!(auth.hasAccessToken||auth.hasRefreshToken);
  }catch{}
  return null
}
function connection(){
  const status=$('status'),alive=sessionAlive(),device=!!(window.JFMSpotifySDK?.deviceId||playback()?.deviceId);
  const connected=alive===false?false:alive===true?true:!!(status?.classList.contains('on')||device);
  const connecting=!!($('connect')?.disabled&&!connected);
  return{connected,connecting,label:connected?'Verbonden':connecting?'Verbinden…':'Niet verbonden'}
}
function station(){const id=window.MAIRStationController?.channel||window.JFMMusicChoice?.channel||document.body.dataset.musicChannel||'mix',label=window.MAIRStationPolicy?.label?.(id)||LABELS[id]||clean(id,60)||'Your Mix';return{id,label:clean(label.replace(/^MAIR\s+/i,''),80)||'Your Mix',pending:Date.now()-stationFeedbackAt<10000?stationFeedback:''}}
function publicDJ(detail=dj()){
  const phase=clean(detail?.phase||'COUNTING',40).toUpperCase();
  if(phase==='SPEAKING')return{state:'ON_AIR',label:'DJ · On air',detail:'MAIRFM DJ is live'};
  if(phase==='RESTORING'||phase==='RECOVERING')return{state:'RECOVERING',label:'DJ · De muziek komt terug',detail:'Verbinding herstellen'};
  if(['PREPARING','ARMED','HANDOFF'].includes(phase))return{state:'PREPARING',label:phase==='ARMED'?'DJ · Zo op de radio':'DJ · Bereidt een radiomoment voor',detail:''};
  if(detail?.skipNextBreak)return{state:'QUIET',label:'DJ · Even stil voor de muziek',detail:''};
  return{state:'QUIET',label:'DJ · Luistert mee',detail:''}
}
function userError(p,online,health){
  if(!online)return{severity:'warning',title:'Geen internet',message:'MAIRFM wacht op verbinding. Zodra je weer online bent, proberen we verder te gaan.',primaryAction:null,secondaryAction:null,diagnosticsCode:'NETWORK_OFFLINE',autoDismiss:false};
  if(health?.reloadNeedsGesture)return{severity:'action',title:'Klaar om verder te gaan',message:'Tik één keer om muziek en DJ-audio weer te activeren.',primaryAction:'resume',secondaryAction:null,diagnosticsCode:'AUDIO_GESTURE',autoDismiss:false};
  if(lastUserError&&Date.now()-lastUserError.at<15000){const scope=lastUserError.scope,low=clean(lastUserError.error,300).toLowerCase();if(scope==='auth')return{severity:'error',title:'Spotify verbinden lukte niet',message:'Probeer het opnieuw. Als het blijft gebeuren, open dan Diagnostics.',primaryAction:'retry',secondaryAction:'diagnostics',diagnosticsCode:'SPOTIFY_CONNECT',autoDismiss:false};if(scope==='request')return{severity:'warning',title:'Nummer zoeken lukte niet',message:'Je uitzending blijft spelen. Probeer de aanvraag straks opnieuw.',primaryAction:null,secondaryAction:'diagnostics',diagnosticsCode:'REQUEST_FAILED',autoDismiss:true};if(/device|apparaat/.test(low))return{severity:'error',title:'Spotify-apparaat niet beschikbaar',message:'Open Spotify één keer op dit apparaat en probeer daarna opnieuw.',primaryAction:'device',secondaryAction:'reconnect',diagnosticsCode:'SPOTIFY_DEVICE',autoDismiss:false}}
  // health.lastError wordt in playback-primary wel gezet maar vrijwel nooit gewist, dus
  // een enkele device-hapering aan het begin van een sessie liet hier permanent
  // "Spotify-apparaat niet beschikbaar" met een knop "Opnieuw verbinden" staan, ook
  // terwijl de muziek gewoon speelde. Een playbackfout telt daarom alleen mee zolang
  // playback nu ook echt stilstaat terwijl het zou moeten spelen.
  const playbackBroken=!!(p?.expectedLive&&!p?.isPlaying);
  const raw=clean(lastStationError||(playbackBroken?(p?.lastError||health?.lastError):''),300),low=raw.toLowerCase();if(!raw)return null;
  if(/premium|403/.test(low))return{severity:'error',title:'Spotify Premium nodig',message:'MAIRFM gebruikt Spotify om volledige nummers af te spelen. Hiervoor is een Premium-account nodig.',primaryAction:'retry',secondaryAction:'diagnostics',diagnosticsCode:'SPOTIFY_PREMIUM',autoDismiss:false};
  if(/device|apparaat|not.ready|geen actief/.test(low))return{severity:'error',title:'Spotify-apparaat niet beschikbaar',message:'Open Spotify één keer op dit apparaat en probeer daarna opnieuw.',primaryAction:'device',secondaryAction:'reconnect',diagnosticsCode:'SPOTIFY_DEVICE',autoDismiss:false};
  if(/gesture|tik|vernieuw/.test(low))return{severity:'action',title:'Klaar om verder te gaan',message:'Tik één keer om muziek en DJ-audio weer te activeren.',primaryAction:'resume',secondaryAction:null,diagnosticsCode:'AUDIO_GESTURE',autoDismiss:false};
  if(p?.expectedLive&&!p?.isPlaying&&Number(health?.failures||0)>1)return{severity:'error',title:'Muziek is gestopt',message:'MAIRFM kon Spotify niet automatisch hervatten.',primaryAction:'resume',secondaryAction:'reconnect',diagnosticsCode:'PLAYBACK_STOPPED',autoDismiss:false};
  if(Date.now()-lastStationErrorAt<12000)return{severity:'error',title:'Station wisselen lukte niet',message:'Je huidige uitzending blijft beschikbaar. Probeer het station opnieuw.',primaryAction:'retry-station',secondaryAction:'diagnostics',diagnosticsCode:'STATION_CHANGE_FAILED',autoDismiss:false};
  return null
}
function get(){
  const p=playback()||{},health=window.JFMPlayback?.health||{},online=navigator.onLine,spotifyConnection=connection(),track=currentTrack(),operation=p.operation||null,djPublicState=publicDJ(),recovering=!!(p.expectedLive&&!p.isPlaying&&(health.recoveryFailures||operation?.type==='recovery'));
  let appState=!online?'OFFLINE':!spotifyConnection.connected?(spotifyConnection.connecting?'CONNECTING':'DISCONNECTED'):health.reloadNeedsGesture?'GESTURE_REQUIRED':recovering?'RECOVERING':operation?.type==='start'?'STARTING':track?(p.isPlaying?'PLAYING':'PAUSED'):'EMPTY';
  const pending=operation&&['next','previous','pause','resume','start'].includes(operation.type)?operation.type:null;
  return{version:'radio-view-state-v1',at:Date.now(),appState,station:station(),track,playbackState:{isPlaying:!!p.isPlaying,expectedLive:!!p.expectedLive,progressMs:Number(p.progressMs||0),durationMs:Number(p.durationMs||track?.durationMs||0)},playbackPendingAction:pending,djPublicState,nextTrack:nextTrack(),spotifyConnection,recoverableError:userError(p,online,health),recoveryJustSucceeded:Date.now()-lastRecoverySuccess<5000}
}
function emit(reason='refresh'){const state=get();for(const fn of listeners)try{fn(state,reason)}catch{};try{window.dispatchEvent(new CustomEvent('mair:ux-state',{detail:{state,reason}}))}catch{}return state}
function subscribe(fn){if(typeof fn!=='function')return()=>{};listeners.add(fn);fn(get(),'subscribe');return()=>listeners.delete(fn)}
['jfm:playback-state','jfm:trackchange','mair:dj-v2-state','mair:dj-speaking','mair:channelchange','mair:station-selected','online','offline','pageshow'].forEach(name=>window.addEventListener(name,e=>{if(name==='mair:channelchange'&&e.detail?.loading){stationFeedback='Station wisselen…';stationFeedbackAt=Date.now()}if(name==='mair:station-selected'){stationFeedback=`${clean(e.detail?.label||'Station')} speelt`;stationFeedbackAt=Date.now()}emit(name)}));
window.addEventListener('mair:station-error',e=>{lastStationError=clean(e.detail?.error||'Station error',300);lastStationErrorAt=Date.now();emit('station-error')});
window.addEventListener('mair:user-error',e=>{lastUserError={scope:clean(e.detail?.scope||'app',40),error:clean(e.detail?.error||'',300),at:Number(e.detail?.at)||Date.now()};emit('user-error')});
window.addEventListener('jfm:playback-state',e=>{const before=e.detail?.previous,after=e.detail?.state;if(before?.expectedLive&&!before?.isPlaying&&after?.isPlaying)lastRecoverySuccess=Date.now()});
function installObserver(){const status=$('status'),connect=$('connect');if(!status)return setTimeout(installObserver,150);const observer=new MutationObserver(()=>emit('connection-dom'));observer.observe(status,{attributes:true,childList:true,characterData:true});if(connect)observer.observe(connect,{attributes:true,childList:true});window.__mairUXStateObserver=observer;emit('installed')}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installObserver,{once:true});else installObserver();
window.MAIRUXState={version:'radio-view-state-v1',get,subscribe,refresh:emit,publicDJ};window.MAIRRuntime?.register?.('mair-ux-state',{version:'radio-view-state-v1',owner:'public-ui-state'});
})();
