// iPhone-safe start flow: wake Spotify first, resume Josh FM automatically when the user returns.
(()=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const PENDING='jfm_start_after_spotify';
  let resuming=false;

  function setInfo(text){
    const el=document.getElementById('queueInfo');
    if(el)el.textContent=text;
  }

  async function startSpotifyQueue(){
    if(!queue?.length) await buildSet();
    if(!queue?.length) throw new Error('Ik kon geen tracks voor de radioset vinden.');
    const uris=queue.slice(0,30).map(x=>x.uri).filter(Boolean);
    if(!uris.length) throw new Error('Geen afspeelbare Spotify-tracks gevonden.');

    await api('/me/player/play',{method:'PUT',body:{uris}});
    await sleep(700);
    try{
      let state=await api('/me/player');
      if(state && !state.is_playing){
        await api('/me/player/play',{method:'PUT'});
        await sleep(500);
        state=await api('/me/player');
      }
      if(state && !state.is_playing){
        await api('/me/player/play',{method:'PUT'});
        await sleep(450);
      }
    }catch{}
  }

  async function actuallyStart(){
    if(resuming)return;
    resuming=true;
    try{
      sessionStorage.removeItem(PENDING);
      if(!queue?.length) await buildSet();
      if(!queue?.length) throw new Error('Ik kon geen tracks voor de radioset vinden.');

      session=[];
      renderHistory();
      scheduleTalk();

      // Spotify is already awake now; play the Josh FM opener, then hand audio back to Spotify.
      if(document.getElementById('jingles')?.checked){
        try{await speakText('Josh FM. Jouw muziek, jouw radioshow.',true)}catch{}
        await sleep(300);
      }

      setInfo('Spotify is actief · Josh FM start…');
      await startSpotifyQueue();
      await refresh().catch(()=>{});
      startPolling();
      setInfo(`${queue.length} tracks klaar · Josh FM is live.`);
    }catch(e){
      const msg=String(e?.message||e);
      if(/device|player|active/i.test(msg)){
        setInfo('Spotify is nog niet als actief apparaat beschikbaar. Open Spotify, tik eventueel één keer op play en ga terug naar Josh FM.');
      }else setInfo('Starten lukte niet: '+msg);
    }finally{resuming=false}
  }

  function wakeSpotify(){
    sessionStorage.setItem(PENDING,'1');
    setInfo('Spotify wordt geopend. Tik daarna linksboven op “Josh FM” om terug te gaan; de radio start dan vanzelf.');
    // A custom scheme is required to wake the native Spotify app from an iPhone web app.
    window.location.href='spotify://';
  }

  window.startRadio=startRadio=async function(){
    if(isIOS && sessionStorage.getItem(PENDING)!=='1'){
      wakeSpotify();
      return;
    }
    await actuallyStart();
  };

  function resumeIfNeeded(){
    if(document.visibilityState==='visible'&&sessionStorage.getItem(PENDING)==='1'){
      // Give iOS/Spotify Connect a brief moment to register the app as active.
      setTimeout(()=>actuallyStart(),550);
    }
  }
  document.addEventListener('visibilitychange',resumeIfNeeded);
  window.addEventListener('pageshow',resumeIfNeeded);
  window.addEventListener('focus',resumeIfNeeded);

  const btn=document.getElementById('start');
  if(btn)btn.onclick=()=>window.startRadio().catch(e=>setInfo(e.message||String(e)));
})();
