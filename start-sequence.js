// iPhone-safe start flow: play the station jingle first, then start Spotify.
(()=>{
  async function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

  async function startSpotifyQueue(){
    if(!queue?.length) await buildSet();
    if(!queue?.length) throw new Error('Ik kon geen tracks voor de radioset vinden.');

    const uris=queue.slice(0,30).map(x=>x.uri).filter(Boolean);
    if(!uris.length) throw new Error('Geen afspeelbare Spotify-tracks gevonden.');

    // Start only after all Josh FM audio has finished.
    await api('/me/player/play',{method:'PUT',body:{uris}});
    await sleep(700);

    // iOS/Spotify Connect occasionally accepts the command but stays paused.
    try{
      const state=await api('/me/player');
      if(state && !state.is_playing){
        await api('/me/player/play',{method:'PUT'});
        await sleep(500);
      }
    }catch{}
  }

  window.startRadio=startRadio=async function(){
    if(!queue?.length) await buildSet();
    if(!queue?.length) throw new Error('Ik kon geen tracks voor de radioset vinden.');

    session=[];
    renderHistory();
    scheduleTalk();

    // Critical ordering for iPhone: Josh FM audio first, Spotify second.
    if(document.getElementById('jingles')?.checked){
      try{await speakText('Josh FM. Jouw muziek, jouw radioshow.',true);}catch{}
      await sleep(250);
    }

    try{
      await startSpotifyQueue();
    }catch(e){
      if(/device/i.test(String(e?.message||e))){
        alert('Open Spotify kort, speel één nummer af en kom daarna terug naar Josh FM.');
        return;
      }
      throw e;
    }

    await refresh().catch(()=>{});
    startPolling();
  };

  const btn=document.getElementById('start');
  if(btn)btn.onclick=()=>window.startRadio().catch(e=>alert(e.message||String(e)));
})();
