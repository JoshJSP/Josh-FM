// MAIRFM semantic public UI state v2. Spotify authorization and browser-device readiness are separate truths.
(()=>{
'use strict';
if(window.MAIRUXState?.version)return;
const listeners=new Set(),$=id=>document.getElementById(id);
let stationFeedback='',stationFeedbackAt=0,lastStationError='',lastStationErrorAt=0,lastRecoverySuccess=0,lastUserError=null;
const LABELS={hits:'Hits',top40:'Top 40',new:'Discovery',nl:'Nederlandstalig',party:'Party',chill:'Chill',summer:'Summer',throwback:'Throwback','00s':'00s','10s':'10s',mix:'Your Mix'};
const clean=(v,n=220)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,n);
function playback(){try{return window.JFMPlaybackState?.get?.()||window.JFMPlayback?.state||null}catch{return null}}
function dj(){try{return window.MAIRDJ?.diagnostics?.()||window.JFMDJAuthoritative?.diagnostics?.()||null}catch{return null}}
function auth(){
  const rel=window.MAIRSpotifySessionReliability?.state||{},base=window.JFMAuth?.state||{},coord=window.MAIRSpotifyCoordinator?.state||{};
  let storedRefresh=false,storedAccess=false;try{storedRefresh=!!localStorage.getItem('jfm_refresh');storedAccess=!!localStorage.getItem('jfm_token')}catch{}
  const hasRefresh=coord.hasRefreshToken??rel.hasRefreshToken??base.hasRefreshToken??storedRefresh;
  const hasAccess=coord.hasAccessToken??rel.hasAccessToken??base.hasAccessToken??storedAccess;
  const reauthRequired=!!(coord.reauthRequired??rel.reauthRequired);
  return{hasRefreshToken:!!hasRefresh,hasAccessToken:!!hasAccess,reauthRequired,authenticated:!!(hasRefresh||hasAccess)&&!reauthRequired,refreshing:!!base.refreshing}
}
function currentTrack(){const item=window.playback?.item||null,p=playback();if(!item&&!p?.trackId)return null;return{id:clean(item?.id||p?.trackId,120),name:clean(item?.name||$('title')?.textContent||'',180),artists:(item?.artists||[]).map(x=>clean(x?.name||x,100)).filter(Boolean),image:item?.album?.images?.[0]?.url||$('artImg')?.src||'',durationMs:Number(item?.duration_ms||p?.durationMs||0)}}
function nextTrack(){const item=window.__jfmSpotifyUpcomingTruth?.items?.[0]||window.JFMStationHealth?.snapshot?.()?.nextTrack||null;if(!item)return null;return{id:clean(item.id,120),name:clean(item.name,180),artists:(item.artists||[]).map(x=>clean(x?.name||x,100)).filter(Boolean),image:item.album?.images?.[0]?.url||item.image||'',request:!!item.request}}
function device(){const id=clean(window.JFMSpotifySDK?.deviceId||'',160);return{ready:!!id,id}}
function connection(){const a=auth(),d=device(),connect=$('connect'),connecting=!a.authenticated&&!a.reauthRequired&&!!connect?.disabled;return{connected:a.authenticated,connecting,label:a.reauthRequired?'Opnieuw koppelen nodig':a.authenticated?(d.ready?'Verbonden':'Verbonden · apparaat herstellen'):(connecting?'Verbinden…':'Niet verbonden'),auth:a,device:d}}
function station(){const id=window.MAIRStationController?.channel||window.JFMMusicChoice?.channel||document.body.dataset.musicChannel||'mix',label=window.MAIRStationPolicy?.label?.(id)||LABELS[id]||clean(id,60)||'Your Mix';return{id,label:clean(label.replace(/^MAIR\s+/i,''),80)||'Your Mix',pending:Date.now()-stationFeedbackAt<10000?stationFeedback:''}}
function djRemaining(detail={}){try{const x=window.MAIRDJCadenceFix?.remaining?.();if(Number.isFinite(Number(x)))return Math.max(0,Number(x))}catch{}const x=Number(detail?.remaining);return Number.isFinite(x)?Math.max(0,x):null}
function publicDJ(detail=dj()||{}){
  const phase=clean(detail?.phase||'COUNTING',40).toUpperCase(),remaining=djRemaining(detail);
  if(phase==='SPEAKING')return{state:'ON_AIR',label:'DJ · On air',detail:'De MAIRFM DJ is live.'};
  if(phase==='RESTORING'||phase==='RECOVERING')return{state:'RECOVERING',label:'DJ · De muziek komt terug',detail:'De overgang wordt veilig afgerond.'};
  if(phase==='HANDOFF')return{state:'PREPARING',label:'DJ · On air voorbereiden',detail:'Muziek en DJ worden veilig overgedragen.'};
  if(phase==='ARMED')return{state:'PREPARING',label:'DJ · Zo op de radio',detail:'De break staat klaar voor de volgende natuurlijke overgang.'};
  if(phase==='PREPARING')return{state:'PREPARING',label:'DJ · Break wordt voorbereid',detail:'De DJ maakt het volgende radiomoment klaar.'};
  if(detail?.skipNextBreak)return{state:'SILENT',label:'DJ · Even stil',detail:'Het volgende radiomoment wordt overgeslagen.'};
  if(remaining===0)return{state:'SCHEDULING',label:'DJ · Radiomoment wordt bepaald',detail:'De DJ pakt de eerstvolgende geschikte natuurlijke overgang.'};
  if(remaining===1)return{state:'LISTENING',label:'DJ · Radiomoment komt dichtbij',detail:'Nog ongeveer 1 nummer tot een mogelijk DJ-moment.'};
  if(remaining!==null)return{state:'LISTENING',label:'DJ · Luistert mee',detail:`Nog ongeveer ${remaining} nummers tot een mogelijk DJ-moment.`};
  return{state:'LISTENING',label:'DJ · Luistert mee',detail:'MAIRFM kiest zelf een natuurlijk radiomoment.'}
}
function recentUserError(){return lastUserError&&Date.now()-lastUserError.at<15000?lastUserError:null}
function userError(p,online,health,spotifyConnection,track){
  const a=spotifyConnection.auth,d=spotifyConnection.device,user=recentUserError(),raw=clean(lastStationError||p?.lastError||health?.lastError,300),low=raw.toLowerCase();
  if(!online)return{severity:'warning',title:'Geen internet',message:'MAIRFM wacht op verbinding. Zodra je weer online bent, proberen we verder te gaan.',primaryAction:null,secondaryAction:null,diagnosticsCode:'NETWORK_OFFLINE',autoDismiss:false};
  if(a.reauthRequired)return{severity:'error',title:'Spotify-sessie verlopen',message:'Spotify heeft de koppeling ongeldig verklaard. Koppel Spotify één keer opnieuw.',primaryAction:'reconnect',secondaryAction:'diagnostics',diagnosticsCode:'SPOTIFY_REAUTH_REQUIRED',autoDismiss:false};
  if(user?.scope==='request')return{severity:'warning',title:'Nummer zoeken lukte niet',message:'Je uitzending blijft beschikbaar. Probeer de aanvraag straks opnieuw.',primaryAction:null,secondaryAction:'diagnostics',diagnosticsCode:'REQUEST_FAILED',autoDismiss:true};
  if(user?.scope==='auth'){
    if(a.authenticated)return{severity:'warning',title:'Spotify tijdelijk niet bereikbaar',message:'Je Spotify-koppeling blijft bewaard. MAIRFM probeert automatisch opnieuw verbinding te maken.',primaryAction:null,secondaryAction:'diagnostics',diagnosticsCode:'SPOTIFY_CONNECT_TEMPORARY',autoDismiss:true};
    return{severity:'error',title:'Spotify verbinden lukte niet',message:'Probeer Spotify opnieuw te verbinden. Als het blijft gebeuren, open Diagnostics.',primaryAction:'retry',secondaryAction:'diagnostics',diagnosticsCode:'SPOTIFY_CONNECT',autoDismiss:false}
  }
  if(/premium|403/.test(low))return{severity:'error',title:'Spotify Premium nodig',message:'MAIRFM gebruikt Spotify om volledige nummers af te spelen. Hiervoor is een Premium-account nodig.',primaryAction:null,secondaryAction:'diagnostics',diagnosticsCode:'SPOTIFY_PREMIUM',autoDismiss:false};
  if(!a.authenticated)return null;
  if(health?.reloadNeedsGesture)return{severity:'action',title:'Klaar om verder te gaan',message:'Tik één keer om muziek en DJ-audio op dit apparaat weer te activeren.',primaryAction:'device',secondaryAction:'diagnostics',diagnosticsCode:'AUDIO_GESTURE',autoDismiss:false};
  if(p?.expectedLive&&!d.ready)return{severity:'action',title:'Afspeelapparaat herstellen',message:'Je Spotify-koppeling is geldig. Tik één keer om MAIRFM op dit apparaat weer hoorbaar te maken.',primaryAction:'device',secondaryAction:'diagnostics',diagnosticsCode:'SPOTIFY_DEVICE',autoDismiss:false};
  if(p?.isPlaying)return null;
  if(p?.expectedLive&&d.ready)return{severity:'action',title:'Muziek staat stil',message:'Tik één keer om je MAIRFM-uitzending verder te laten spelen.',primaryAction:'device',secondaryAction:'diagnostics',diagnosticsCode:'PLAYBACK_STOPPED',autoDismiss:false};
  if(Date.now()-lastStationErrorAt<12000)return{severity:'error',title:'Station wisselen lukte niet',message:'Je huidige uitzending blijft beschikbaar. Probeer het station opnieuw.',primaryAction:'retry-station',secondaryAction:'diagnostics',diagnosticsCode:'STATION_CHANGE_FAILED',autoDismiss:false};
  return null
}
function get(){
  const p=playback()||{},health=window.JFMPlayback?.health||{},online=navigator.onLine,spotifyConnection=connection(),track=currentTrack(),operation=p.operation||null,djPublicState=publicDJ(),a=spotifyConnection.auth,d=spotifyConnection.device;
  const recovering=!!(a.authenticated&&p.expectedLive&&(!d.ready||!p.isPlaying));
  let appState=!online?'OFFLINE':a.reauthRequired?'DISCONNECTED':!a.authenticated?(spotifyConnection.connecting?'CONNECTING':'DISCONNECTED'):health.reloadNeedsGesture?'GESTURE_REQUIRED':operation?.type==='start'?'STARTING':recovering?'RECOVERING':track?(p.isPlaying?'PLAYING':'PAUSED'):'EMPTY';
  const pending=operation&&['next','previous','pause','resume','start'].includes(operation.type)?operation.type:null;
  return{version:'radio-view-state-v2-auth-device',at:Date.now(),appState,station:station(),track,playbackState:{isPlaying:!!p.isPlaying,expectedLive:!!p.expectedLive,progressMs:Number(p.progressMs||0),durationMs:Number(p.durationMs||track?.durationMs||0)},playbackPendingAction:pending,djPublicState,nextTrack:nextTrack(),spotifyConnection,recoverableError:userError(p,online,health,spotifyConnection,track),recoveryJustSucceeded:Date.now()-lastRecoverySuccess<5000}
}
function emit(reason='refresh'){const state=get();for(const fn of listeners)try{fn(state,reason)}catch{};try{window.dispatchEvent(new CustomEvent('mair:ux-state',{detail:{state,reason}}))}catch{}return state}
function subscribe(fn){if(typeof fn!=='function')return()=>{};listeners.add(fn);fn(get(),'subscribe');return()=>listeners.delete(fn)}
['jfm:playback-state','jfm:trackchange','mair:dj-v2-state','mair:dj-speaking','mair:dj-schedule','mair:channelchange','mair:station-selected','mair:spotify-coordinator','mair:spotify-device-recovered','online','offline','pageshow'].forEach(name=>window.addEventListener(name,e=>{
  if(name==='mair:channelchange'&&e.detail?.loading){stationFeedback='Station wisselen…';stationFeedbackAt=Date.now()}
  if(name==='mair:station-selected'){stationFeedback=`${clean(e.detail?.label||'Station')} speelt`;stationFeedbackAt=Date.now();lastStationError='';lastStationErrorAt=0}
  if(name==='mair:spotify-device-recovered'||(name==='mair:spotify-coordinator'&&e.detail?.type==='ready')){lastRecoverySuccess=Date.now();lastUserError=null}
  emit(name)
}));
window.addEventListener('mair:station-error',e=>{lastStationError=clean(e.detail?.error||'Station error',300);lastStationErrorAt=Date.now();emit('station-error')});
window.addEventListener('mair:user-error',e=>{lastUserError={scope:clean(e.detail?.scope||'app',40),error:clean(e.detail?.error||'',300),at:Number(e.detail?.at)||Date.now()};emit('user-error')});
window.addEventListener('jfm:playback-state',e=>{const before=e.detail?.previous,after=e.detail?.state;if(before?.expectedLive&&!before?.isPlaying&&after?.isPlaying){lastRecoverySuccess=Date.now();lastUserError=null}});
window.MAIRUXState={version:'radio-view-state-v2-auth-device',get,subscribe,refresh:emit,publicDJ,auth,device};window.MAIRRuntime?.register?.('mair-ux-state',{version:'v2-auth-device',owner:'public-ui-state'});
emit('installed');
})();
