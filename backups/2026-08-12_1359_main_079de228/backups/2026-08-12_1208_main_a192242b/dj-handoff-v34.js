// Josh FM DJ handoff v34 — preserve Spotify queue and playback position across DJ breaks.
(()=>{
  const $=id=>document.getElementById(id),wait=ms=>new Promise(r=>setTimeout(r,ms));
  const TRACK_URI=/^spotify:track:[A-Za-z0-9]{22}$/;
  const DEVICE=/^[A-Za-z0-9_-]{8,128}$/;
  let busy=false,armed=null,polling=false;
  const status=(text,bad=false)=>{const q=$('queueInfo');if(q){q.textContent=text;q.style.color=bad?'#ffb4b4':''}};
  const truth=()=>window.JFMPlaybackState||null;
  const player=()=>window.jfmSpotifyPlayer||null;
  const currentState=async()=>{try{return await api('/me/player')}catch{return null}};
  const validDevice=()=>{const raw=String(truth()?.get?.()?.deviceId||localStorage.getItem('jfm_spotify_device_id')||'').trim();return DEVICE.test(raw)?raw:''};
  const pathWithDevice=base=>{const id=validDevice();return id?base+'?device_id='+encodeURIComponent(id):base};
  const sharedBusy=()=>{try{return !!djBusy}catch{return false}};
  const setSharedBusy=value=>{try{djBusy=!!value}catch{}};
  async function setVolume(v){try{if(typeof player()?.setVolume==='function')await player().setVolume(v)}catch{}}
  async function verifyPlaying(uri='',tries=9){for(let i=0;i<tries;i++){await wait(160+i*55);const s=await currentState();if(s?.is_playing&&(!uri||s.item?.uri===uri)){try{truth()?.ingest?.(s,'dj-handoff-v34')}catch{};return s}}return null}
  async function pausePreservingPosition(){
    try{truth()?.patch?.({expectedLive:true,intent:'dj-handoff'},'dj-handoff-v34-start')}catch{}
    await setVolume(0);
    try{if(typeof player()?.pause==='function')await player().pause()}catch{}
    try{await api(pathWithDevice('/me/player/pause'),{method:'PUT'})}catch{}
    for(let i=0;i<7;i++){await wait(120+i*45);const s=await currentState();if(s&&!s.is_playing)return s}
    return null
  }
  async function resumePreservingContext(expectedUri=''){
    // Resume the existing Spotify context with NO uri body. This preserves queue position and avoids restarting a track.
    try{await api(pathWithDevice('/me/player/play'),{method:'PUT'})}catch(e){throw new Error('Spotify kon de bestaande radioset niet hervatten. '+String(e?.message||e))}
    let s=await verifyPlaying(expectedUri,8);
    if(!s&&expectedUri){
      // If Spotify moved naturally while the DJ was talking, accept the new playing track instead of forcing the old URI back to 0:00.
      s=await verifyPlaying('',4);
    }
    if(!s)throw new Error('Spotify bevestigde hervatten niet.');
    await setVolume(1);return s
  }
  async function buildSpeech(track,manual){
    const [fact,weather]=await Promise.all([getFact(track),getWeather()]);
    const text=await makeDJScript(track,fact,weather,manual);
    if(!text)return null;
    try{if(typeof window.prepareSpeech==='function'){const ok=await window.prepareSpeech(text,false);if(ok===false)return null}}catch{}
    return{text,fact,weather}
  }
  async function speak(pack,manual){
    if(!pack?.text)return false;
    if($('djText'))$('djText').textContent=pack.text;
    if($('factSource'))$('factSource').classList.add('hidden');
    if($('jingles')?.checked&&!manual&&Math.random()<.2)try{await speakText('Josh FM.',true)}catch{}
    try{return(await speakText(pack.text,false))!==false}catch{return false}
  }
  async function runBreak(track=null,manual=false){
    if(busy||sharedBusy())return false;busy=true;setSharedBusy(true);
    let paused=false,resumed=false,before=null;
    try{
      before=await currentState();
      const expectedUri=TRACK_URI.test(before?.item?.uri||'')?before.item.uri:'';
      const target=track||(before?.item?trackObj(before.item):null);
      status('DJ-break wordt voorbereid · muziek speelt door.');
      const pack=await buildSpeech(target,manual);
      if(!pack){status('DJ-break niet klaar · muziek blijft spelen.',true);return false}
      const pausedState=await pausePreservingPosition();paused=!!pausedState;
      if(!paused)throw new Error('Spotify kon niet veilig worden gepauzeerd.');
      const spoken=await speak(pack,manual);
      resumed=!!(await resumePreservingContext(expectedUri));
      try{truth()?.patch?.({expectedLive:true,intent:'radio-live'},'dj-handoff-v34-complete')}catch{}
      try{scheduleTalk()}catch{}
      status(spoken?'DJ klaar · muziek hervat.':'DJ overgeslagen · muziek hervat.');
      setTimeout(()=>refresh().catch(()=>{}),450);return spoken&&resumed
    }catch(e){
      status('DJ-fout · '+String(e?.message||e),true);
      if(paused&&!resumed){try{await api(pathWithDevice('/me/player/play'),{method:'PUT'});resumed=!!(await verifyPlaying('',5))}catch{}}
      return false
    }finally{await setVolume(1);setSharedBusy(false);busy=false}
  }
  function setArmedUi(on){const b=$('djNow');if(!b)return;b.dataset.queued=on?'1':'0';const strong=b.querySelector('b'),small=b.querySelector('span');if(strong)strong.textContent=on?'🎙️ DJ staat klaar':'🎙️ DJ nu';if(small)small.textContent=on?'Praat na dit nummer':'Laat hem iets vertellen'}
  function ownManualButton(){
    const old=$('djNow');if(!old||old.dataset.jfmHandoffOwner==='v34')return;
    const fresh=old.cloneNode(true);old.replaceWith(fresh);fresh.dataset.jfmHandoffOwner='v34';
    fresh.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();if(busy)return;const id=playback?.item?.id;if(!id)return;if(armed?.id===id){armed=null;setArmedUi(false);return}armed={id,track:trackObj(playback.item)};setArmedUi(true)},true)
  }
  setInterval(async()=>{
    if(polling||busy||!armed||document.visibilityState!=='visible')return;polling=true;
    try{const s=await currentState();if(s?.item?.id&&s.item.id!==armed.id){const a=armed;armed=null;setArmedUi(false);await runBreak(a.track,true)}}finally{polling=false}
  },1200);
  // Replace automatic DJ break entry point. The old dj-now-queue transition object may still prefetch speech,
  // but it no longer owns the actual pause/resume handoff or the manual button.
  window.djBreak=runBreak;
  window.JFMDJTransition={version:'handoff-v34-preserve-context',transition:({track,manual=false}={})=>runBreak(track,manual),get busy(){return busy}};
  const boot=()=>{ownManualButton();if(!$('djNow'))setTimeout(boot,150)};boot();
  window.addEventListener('pageshow',()=>setTimeout(ownManualButton,200));
  window.JFMDJHandoff={version:'v34-preserve-context',runBreak,get busy(){return busy},get armed(){return armed?.id||''}};
})();
