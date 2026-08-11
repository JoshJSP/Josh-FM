// Josh FM PWA platform layer — media session, sleep timer, connectivity and update UX.
(()=>{
  const $=id=>document.getElementById(id),SLEEP_KEY='jfm_sleep_timer_v1';
  let sleepTimer=null,sleepState=loadSleep(),waitingWorker=null,lastTrackId='';

  function loadSleep(){try{return JSON.parse(localStorage.getItem(SLEEP_KEY)||'null')}catch{return null}}
  function saveSleep(x){sleepState=x;try{x?localStorage.setItem(SLEEP_KEY,JSON.stringify(x)):localStorage.removeItem(SLEEP_KEY)}catch{};renderSleep()}
  function safe(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

  function currentTrack(){
    try{if(playback?.item)return trackObj(playback.item)}catch{}
    try{const s=window.JFMPlaybackState?.get?.();if(s?.trackId){const q=Array.isArray(queue)?queue:[],t=q.find(x=>x.id===s.trackId);if(t)return t}}catch{}
    return null
  }
  function mediaArtwork(t){const src=t?.image||'';return src?[{src,sizes:'512x512'}]:[]}
  function updateMediaSession(){
    if(!('mediaSession'in navigator))return;
    const t=currentTrack();if(!t?.id)return;
    try{
      navigator.mediaSession.metadata=new MediaMetadata({title:t.name||'Josh FM',artist:(t.artists||[]).join(', ')||'Josh FM',album:window.JFMStationClock?.current?.()?.show?.name||'Josh FM',artwork:mediaArtwork(t)});
      const s=window.JFMPlaybackState?.get?.();navigator.mediaSession.playbackState=s?.isPlaying?'playing':'paused';
      const duration=Number(t.duration||s?.durationMs||0)/1000,position=Number(s?.progressMs||0)/1000;
      if(duration>0&&position>=0&&position<=duration&&navigator.mediaSession.setPositionState)navigator.mediaSession.setPositionState({duration,playbackRate:1,position:Math.min(position,duration)});
    }catch{}
  }
  function installMediaActions(){
    if(!('mediaSession'in navigator))return;
    const bind=(name,fn)=>{try{navigator.mediaSession.setActionHandler(name,fn)}catch{}};
    bind('play',()=>window.JFMPlayback?.resume?.());bind('pause',()=>window.JFMPlayback?.pause?.());bind('nexttrack',()=>window.JFMPlayback?.next?.());bind('previoustrack',()=>window.JFMPlayback?.previous?.());
  }

  async function stopPlayback(reason='sleep'){
    try{await window.JFMPlayback?.pause?.()}catch{}
    saveSleep(null);setConnectivityNote(reason==='track-end'?'Sleep timer klaar · gestopt na dit nummer.':'Sleep timer klaar · Josh FM is gepauzeerd.');
  }
  function clearTimer(){if(sleepTimer)clearTimeout(sleepTimer);sleepTimer=null}
  function scheduleSleep(){
    clearTimer();if(!sleepState)return;
    if(sleepState.mode==='after-track')return;
    const left=Number(sleepState.at||0)-Date.now();if(left<=0){stopPlayback('sleep').catch(()=>{});return}
    sleepTimer=setTimeout(()=>stopPlayback('sleep').catch(()=>{}),Math.min(left,2147483647));
  }
  function setMinutes(minutes){saveSleep({mode:'time',at:Date.now()+Number(minutes)*60000,minutes:Number(minutes)});scheduleSleep()}
  function stopAfterTrack(){const t=currentTrack();saveSleep({mode:'after-track',trackId:t?.id||'',setAt:Date.now()})}
  function cancelSleep(){clearTimer();saveSleep(null)}
  function onTrackChange(id){
    if(sleepState?.mode==='after-track'&&sleepState.trackId&&id&&id!==sleepState.trackId)stopPlayback('track-end').catch(()=>{});
    updateMediaSession();
  }
  function sleepLabel(){
    if(!sleepState)return'Sleep timer staat uit.';
    if(sleepState.mode==='after-track')return'Stopt na dit nummer.';
    const left=Math.max(0,Number(sleepState.at||0)-Date.now()),mins=Math.ceil(left/60000);return`Stopt over ongeveer ${mins} min.`
  }
  function installSleepCard(){
    if($('jfmSleepCard'))return;const pane=$('tab-settings');if(!pane)return;
    const card=document.createElement('article');card.className='card';card.id='jfmSleepCard';
    card.innerHTML='<div class="kicker">SLEEP TIMER</div><h3>Automatisch stoppen</h3><div class="chips" id="jfmSleepChoices"><button class="chip" data-min="15">15 min</button><button class="chip" data-min="30">30 min</button><button class="chip" data-min="45">45 min</button><button class="chip" data-min="60">60 min</button><button class="chip" data-track="1">Na dit nummer</button></div><p id="jfmSleepStatus" class="muted">Sleep timer staat uit.</p><button id="jfmSleepCancel" class="secondary hidden" type="button">Annuleer sleep timer</button>';
    const appCard=$('installHint')?.closest('.card');if(appCard)pane.insertBefore(card,appCard);else pane.appendChild(card);
    $('jfmSleepChoices')?.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.track)stopAfterTrack();else if(b.dataset.min)setMinutes(Number(b.dataset.min))});$('jfmSleepCancel')?.addEventListener('click',cancelSleep);renderSleep()
  }
  function renderSleep(){const s=$('jfmSleepStatus'),b=$('jfmSleepCancel');if(s)s.textContent=sleepLabel();if(b)b.classList.toggle('hidden',!sleepState)}

  function ensureConnectivityBar(){
    if($('jfmConnectivity'))return $('jfmConnectivity');const shell=document.querySelector('.shell');if(!shell)return null;
    const x=document.createElement('div');x.id='jfmConnectivity';x.className='jfm-connectivity hidden';shell.insertBefore(x,shell.firstChild);return x
  }
  function setConnectivityNote(text='',kind='info'){const x=ensureConnectivityBar();if(!x)return;x.textContent=text;x.dataset.kind=kind;x.classList.toggle('hidden',!text);if(text&&kind==='info')setTimeout(()=>{if(x.textContent===text)x.classList.add('hidden')},4500)}
  function renderNetwork(){if(!navigator.onLine)setConnectivityNote('Geen internet · de app blijft open, maar Spotify en Fish kunnen tijdelijk niet werken.','warn');else setConnectivityNote('Verbinding hersteld · Josh FM probeert verder te gaan.','info')}

  function showUpdate(reg){
    if(!reg?.waiting)return;waitingWorker=reg.waiting;let bar=$('jfmUpdateBanner');
    if(!bar){bar=document.createElement('div');bar.id='jfmUpdateBanner';bar.className='jfm-update-banner';bar.innerHTML='<span>Nieuwe Josh FM-versie klaar.</span><button type="button" id="jfmApplyUpdate">Update</button><button type="button" id="jfmLaterUpdate">Later</button>';document.body.appendChild(bar);$('jfmApplyUpdate')?.addEventListener('click',()=>{waitingWorker?.postMessage?.({type:'SKIP_WAITING'})});$('jfmLaterUpdate')?.addEventListener('click',()=>bar.classList.add('hidden'))}
    bar.classList.remove('hidden')
  }
  async function installServiceWorkerUX(){
    if(!('serviceWorker'in navigator))return;
    try{
      const reg=await navigator.serviceWorker.ready;if(reg.waiting)showUpdate(reg);
      reg.addEventListener('updatefound',()=>{const nw=reg.installing;if(!nw)return;nw.addEventListener('statechange',()=>{if(nw.state==='installed'&&navigator.serviceWorker.controller)showUpdate(reg)})});
      navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload());
      setInterval(()=>reg.update().catch(()=>{}),30*60*1000)
    }catch{}
  }

  function install(){installSleepCard();installMediaActions();scheduleSleep();renderSleep();renderNetwork();updateMediaSession();installServiceWorkerUX()}
  window.addEventListener('jfm:trackchange',e=>onTrackChange(e.detail?.trackId||''));window.addEventListener('jfm:playback-state',updateMediaSession);window.addEventListener('online',renderNetwork);window.addEventListener('offline',renderNetwork);
  setInterval(()=>{renderSleep();updateMediaSession()},5000);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
  window.JFMPWA={version:'pwa-v1-media-sleep-update',setSleepMinutes:setMinutes,stopAfterTrack,cancelSleep,get sleep(){return sleepState},updateMediaSession,showUpdate,setConnectivityNote};
})();
