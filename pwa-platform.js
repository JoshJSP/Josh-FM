// MAIR PWA platform layer — sole MediaSession owner, iOS metadata reassertion, sleep timer and update UX.
(()=>{
  const $=id=>document.getElementById(id),SLEEP_KEY='jfm_sleep_timer_v1';
  let waitingWorker=null,wasOffline=!navigator.onLine,updateCheckTimer=null,lastMediaTrackId='',mediaTimers=[];
  function ensureStyles(){if(document.querySelector('link[data-jfm-pwa]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href='./pwa-platform.css';l.dataset.jfmPwa='1';document.head.appendChild(l)}
  function loadSleep(){try{return JSON.parse(localStorage.getItem(SLEEP_KEY)||'null')}catch{return null}}
  function normalizeRaw(item){if(!item?.id)return null;try{return trackObj(item)}catch{}return{id:item.id,uri:item.uri||'',name:item.name||'MAIR',artists:(item.artists||[]).map(a=>a?.name||a).filter(Boolean),album:item.album?.name||'',image:item.album?.images?.[0]?.url||'',duration:Number(item.duration_ms||0),url:item.external_urls?.spotify||''}}
  function currentTrack(){try{const raw=playback?.item||playback?.track_window?.current_track;if(raw?.id){const t=normalizeRaw(raw);if(t)return t}}catch{}try{const s=window.JFMPlaybackState?.get?.();if(s?.trackId){const q=Array.isArray(queue)?queue:[],t=q.find(x=>x.id===s.trackId);if(t)return t}}catch{}return null}
  // iOS kiest zelf welke artwork-maat het vergrendelscherm gebruikt en gaat daarbij
  // uit van de opgegeven sizes. Hier stond een lijst die drie keer dezelfde URL
  // aanmeldde als 512x512, 256x256 en 96x96; die maten waren verzonnen. trackObj()
  // bewaart namelijk maar een URL (images[1], meestal 300x300). Spotify levert per
  // album wel een echte images-array met width/height, dus die gebruiken we zodra
  // die bij dezelfde track hoort, en anders exact een entry zonder maatclaim.
  function rawAlbumImages(trackId){try{const raw=playback?.item||playback?.track_window?.current_track;if(!raw?.id||(trackId&&raw.id!==trackId))return[];const list=raw.album?.images;return Array.isArray(list)?list.filter(x=>x?.url):[]}catch{return[]}}
  function mediaArtwork(t){
    const images=rawAlbumImages(t?.id);
    if(images.length)return images.map(x=>{const w=Number(x.width)||0,h=Number(x.height)||0;return w&&h?{src:x.url,sizes:`${w}x${h}`,type:'image/jpeg'}:{src:x.url,type:'image/jpeg'}});
    const src=t?.image||'';return src?[{src,type:'image/jpeg'}]:[]
  }
  function safePositionState(t,s,forceReset=false){if(typeof navigator.mediaSession?.setPositionState!=='function')return;const durationMs=Number(t?.duration||s?.durationMs||0);if(!Number.isFinite(durationMs)||durationMs<1000)return;let progressMs=forceReset?0:Number(s?.progressMs||0);if(!Number.isFinite(progressMs)||progressMs<0)progressMs=0;if(s?.trackId&&t?.id&&s.trackId!==t.id)progressMs=0;progressMs=Math.min(progressMs,Math.max(0,durationMs-1));const duration=durationMs/1000,position=progressMs/1000;if(position>=duration)return;if(!Number.isFinite(duration)||!Number.isFinite(position)||duration<=0||position<0)return;try{navigator.mediaSession.setPositionState({duration,playbackRate:1,position})}catch{}}
  function updateMediaSession({reset=false}={}){if(!('mediaSession'in navigator))return false;const t=currentTrack();const s=window.JFMPlaybackState?.get?.()||{};
    // playbackState eerst, ook zonder track: anders blijft het vergrendelscherm na
    // uitloggen of een leeggelopen sessie op 'playing' staan.
    try{navigator.mediaSession.playbackState=s?.isPlaying?'playing':'paused'}catch{}
    if(!t?.id)return false;const changed=t.id!==lastMediaTrackId;lastMediaTrackId=t.id;try{navigator.mediaSession.metadata=new MediaMetadata({title:t.name||'MAIR',artist:(t.artists||[]).join(', ')||'MAIR',album:t.album||window.JFMStationClock?.current?.()?.show?.name||'MAIR',artwork:mediaArtwork(t)})}catch{}safePositionState(t,s,reset||changed);return true}
  function reassertMediaSession(reset=false){for(const t of mediaTimers)clearTimeout(t);mediaTimers=[];for(const delay of [0,120,400,1000,2200])mediaTimers.push(setTimeout(()=>updateMediaSession({reset:reset&&delay===0}),delay))}
  function installMediaActions(){if(!('mediaSession'in navigator))return;const bind=(name,fn)=>{try{navigator.mediaSession.setActionHandler(name,fn)}catch{}};bind('play',()=>window.JFMPlayback?.resume?.());bind('pause',()=>window.JFMPlayback?.pause?.());bind('nexttrack',()=>window.JFMPlayback?.next?.());bind('previoustrack',()=>window.JFMPlayback?.previous?.())}
  // De sleeptimer is eigendom van mair-sleep.js (window.MAIRSleep). Dit bestand had
  // een tweede, volledige implementatie op dezelfde localStorage-key
  // jfm_sleep_timer_v1: een eigen setTimeout via scheduleSleep(), een eigen
  // stopPlayback() en een eigen 'na dit nummer' die pauzeerde bij de trackwissel
  // in plaats van bij het natuurlijke einde. De kaart erbij werd al door
  // mair-user-controls.js (purgeLegacyUi) verwijderd, dus de knoppen waren
  // onbereikbaar terwijl de timers bleven draaien. Na een reload plande
  // install() ze zelfs opnieuw op basis van de opgeslagen key, waarna beide
  // eigenaars vuurden. Alleen de weergave (sleepLabel/renderSleep) blijft hier,
  // en die leest de key nu alleen: schrijven en pauzeren doet mair-sleep.js.
  function onTrackChange(id){updateMediaSession({reset:true});reassertMediaSession(true)}
  function sleepLabel(){const x=loadSleep();if(!x)return'Sleeptimer staat uit.';if(x.mode==='after-track')return'Stopt na dit nummer.';const left=Math.max(0,Number(x.at||0)-Date.now()),mins=Math.ceil(left/60000);return`Stopt over ongeveer ${mins} min.`}
  function renderSleep(){const s=$('jfmSleepStatus'),b=$('jfmSleepCancel');if(s)s.textContent=sleepLabel();if(b)b.classList.toggle('hidden',!loadSleep())}
  function ensureConnectivityBar(){if($('jfmConnectivity'))return $('jfmConnectivity');const shell=document.querySelector('.shell');if(!shell)return null;const x=document.createElement('div');x.id='jfmConnectivity';x.className='jfm-connectivity hidden';shell.insertBefore(x,shell.firstChild);return x}
  function setConnectivityNote(text='',kind='info'){const x=ensureConnectivityBar();if(!x)return;x.textContent=text;x.dataset.kind=kind;x.classList.toggle('hidden',!text);if(text&&kind==='info')setTimeout(()=>{if(x.textContent===text)x.classList.add('hidden')},4500)}
  function renderNetwork({initial=false}={}){if(!navigator.onLine){wasOffline=true;setConnectivityNote('Geen internet · MAIR blijft open, maar Spotify en Fish Audio kunnen tijdelijk niet werken.','warn');return}if(wasOffline&&!initial){wasOffline=false;setConnectivityNote('Verbinding hersteld · MAIR probeert verder te gaan.','info');return}wasOffline=false;if(initial){const x=ensureConnectivityBar();x?.classList.add('hidden')}}
  function showUpdate(reg){if(!reg?.waiting)return;waitingWorker=reg.waiting;let bar=$('jfmUpdateBanner');if(!bar){bar=document.createElement('div');bar.id='jfmUpdateBanner';bar.className='jfm-update-banner';bar.innerHTML='<span>Nieuwe MAIR-versie klaar.</span><button type="button" id="jfmApplyUpdate">Update</button><button type="button" id="jfmLaterUpdate">Later</button>';document.body.appendChild(bar);$('jfmApplyUpdate')?.addEventListener('click',()=>waitingWorker?.postMessage?.({type:'SKIP_WAITING'}));$('jfmLaterUpdate')?.addEventListener('click',()=>bar.classList.add('hidden'))}bar.classList.remove('hidden')}
  async function checkForUpdate(reg){if(document.visibilityState!=='visible'||!navigator.onLine)return;if(reg?.waiting)showUpdate(reg);try{await reg.update();if(reg.waiting)showUpdate(reg)}catch{}}
  async function installServiceWorkerUX(){if(!('serviceWorker'in navigator))return;try{const reg=await navigator.serviceWorker.ready;if(reg.waiting)showUpdate(reg);reg.addEventListener('updatefound',()=>{const nw=reg.installing;if(!nw)return;nw.addEventListener('statechange',()=>{if(nw.state==='installed'&&navigator.serviceWorker.controller)showUpdate(reg)})});let reloading=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloading)return;reloading=true;location.reload()});if(updateCheckTimer)clearInterval(updateCheckTimer);updateCheckTimer=setInterval(()=>checkForUpdate(reg),30*60*1000);window.addEventListener('pageshow',()=>setTimeout(()=>checkForUpdate(reg),1200));document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(()=>checkForUpdate(reg),800)})}catch{}}
  function install(){ensureStyles();installMediaActions();renderSleep();renderNetwork({initial:true});updateMediaSession({reset:true});reassertMediaSession(true);installServiceWorkerUX()}
  window.addEventListener('jfm:trackchange',e=>onTrackChange(e.detail?.trackId||''));window.addEventListener('jfm:playback-state',()=>reassertMediaSession(false));window.addEventListener('online',()=>renderNetwork());window.addEventListener('offline',()=>renderNetwork());// De MediaSession-herbevestiging zat hier ook op een timer van 2 seconden. Dat is
// overbodig: jfm:trackchange doet updateMediaSession({reset:true}) plus een
// reassert-reeks op 0/120/400/1000/2200 ms, en jfm:playback-state doet bij elke
// ingest opnieuw een reassert. De timer bouwde daartussen alleen een identiek
// MediaMetadata-object en schreef een positie die tussen twee events toch niet
// verandert. Alleen de sleeptimer-weergave blijft hier op een interval staan.
setInterval(renderSleep,2000);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
  window.JFMPWA={version:'mair-pwa-v5',setSleepMinutes:m=>window.MAIRSleep?.scheduleMinutes?.(m),stopAfterTrack:()=>window.MAIRSleep?.scheduleAfterTrack?.(),cancelSleep:()=>window.MAIRSleep?.cancel?.(),get sleep(){return loadSleep()},updateMediaSession,reassertMediaSession,showUpdate,setConnectivityNote,checkForUpdate};
})();