// iPhone-safe Josh FM start flow.
(()=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const PENDING='jfm_start_after_spotify';
  let starting=false;

  function setInfo(text){
    const el=document.getElementById('queueInfo');
    if(el)el.textContent=text;
  }
  function setButton(text){
    const b=document.getElementById('start');
    if(b)b.textContent=text;
  }
  async function withTimeout(promise,ms){
    return Promise.race([promise,new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),ms))]);
  }

  async function startSpotifyQueue(){
    if(!queue?.length) await buildSet();
    if(!queue?.length) throw new Error('Ik kon geen tracks voor de radioset vinden.');
    const uris=queue.slice(0,30).map(x=>x.uri).filter(Boolean);
    if(!uris.length) throw new Error('Geen afspeelbare Spotify-tracks gevonden.');
    await api('/me/player/play',{method:'PUT',body:{uris}});
    await sleep(650);
    const state=await api('/me/player').catch(()=>null);
    if(state && !state.is_playing) await api('/me/player/play',{method:'PUT'}).catch(()=>{});
  }

  async function actuallyStart(){
    if(starting)return;
    starting=true;
    setButton('Josh FM start…');
    setInfo('Josh FM wordt gestart…');
    try{
      sessionStorage.removeItem(PENDING);
      if(!queue?.length){
        setInfo('Radioset wordt gemaakt…');
        await buildSet();
      }
      if(!queue?.length) throw new Error('Ik kon geen tracks voor de radioset vinden.');
      session=[];
      renderHistory();
      scheduleTalk();

      if(document.getElementById('jingles')?.checked){
        setInfo('Josh FM-jingle…');
        // A broken TTS request may never be allowed to block music playback.
        try{await withTimeout(Promise.resolve(speakText('Josh FM. Jouw muziek, jouw radioshow.',true)),7000)}catch{}
      }

      setInfo('Muziek wordt gestart…');
      await startSpotifyQueue();
      await refresh().catch(()=>{});
      startPolling();
      setInfo(`${queue.length} tracks klaar · Josh FM is live.`);
    }catch(e){
      const msg=String(e?.message||e);
      if(/device|player|active|404/i.test(msg)) setInfo('Spotify ziet nog geen actief apparaat. Open Spotify, speel heel kort een nummer af en ga terug naar Josh FM.');
      else setInfo('Starten lukte niet: '+msg);
    }finally{
      starting=false;
      setButton('Start Josh FM');
    }
  }

  function wakeSpotify(){
    sessionStorage.setItem(PENDING,'1');
    setInfo('Spotify wordt geopend… Ga daarna terug naar Josh FM; de radio start automatisch.');
    setButton('Spotify openen…');
    // Must run synchronously inside the tap gesture on iOS.
    window.location.assign('spotify:');
  }

  window.startRadio=async function(){
    setInfo('Startknop ontvangen…');
    if(isIOS && sessionStorage.getItem(PENDING)!=='1'){
      wakeSpotify();
      return;
    }
    await actuallyStart();
  };

  function resumeIfNeeded(){
    if(document.visibilityState==='visible'&&sessionStorage.getItem(PENDING)==='1'){
      setInfo('Terug van Spotify · Josh FM start…');
      setTimeout(()=>actuallyStart(),650);
    }
  }
  document.addEventListener('visibilitychange',resumeIfNeeded);
  window.addEventListener('pageshow',resumeIfNeeded);
  window.addEventListener('focus',resumeIfNeeded);

  const btn=document.getElementById('start');
  if(btn){
    // Capture listener prevents another enhancement script from swallowing the tap.
    btn.addEventListener('click',e=>{
      e.preventDefault();
      e.stopImmediatePropagation();
      window.startRadio().catch(err=>{setInfo('Starten lukte niet: '+(err?.message||String(err)));setButton('Start Josh FM')});
    },true);
  }
})();
