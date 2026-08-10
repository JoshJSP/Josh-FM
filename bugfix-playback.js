(()=>{
  const $=id=>document.getElementById(id);
  const wait=ms=>new Promise(r=>setTimeout(r,ms));

  function ensureValidSource(){
    const source=$('source');
    const playlist=$('playlist');
    if(!source)return;
    if(source.value==='playlist'){
      const raw=(playlist?.value||'').trim();
      const valid=/playlist[/:]([A-Za-z0-9]+)/.test(raw)||/^[A-Za-z0-9]{10,}$/.test(raw);
      if(!valid){
        source.value='top';
        if(playlist)playlist.classList.add('hidden');
        try{
          const s=JSON.parse(localStorage.getItem('jfm_settings')||'{}');
          s.source='top';
          localStorage.setItem('jfm_settings',JSON.stringify(s));
        }catch{}
      }
    }
  }

  async function forceSpotifyPlaying(){
    for(let attempt=0;attempt<3;attempt++){
      try{
        await api('/me/player/play',{method:'PUT'});
        await wait(attempt===0?650:1000);
        const state=await api('/me/player');
        if(state?.is_playing){
          playback=state;
          try{renderPlayback(state)}catch{}
          return true;
        }
      }catch(e){console.warn('Spotify resume attempt',attempt+1,e)}
    }
    return false;
  }

  async function safeNext(){
    try{
      if(typeof playback!=='undefined'&&playback?.item?.id&&typeof recordSkip==='function')recordSkip(playback.item.id);
      await api('/me/player/next',{method:'POST'});
      await wait(350);
      await forceSpotifyPlaying();
      setTimeout(()=>{try{refresh()}catch{}},500);
    }catch(e){
      console.error('Josh FM next error',e);
      const q=$('queueInfo');
      if(q)q.textContent='Volgende nummer lukte niet: '+String(e?.message||e||'Onbekende fout');
    }
  }

  async function safeStart(){
    ensureValidSource();
    const btn=$('start');
    if(btn)btn.disabled=true;
    try{
      if(typeof queue==='undefined'||!Array.isArray(queue)||queue.length===0)await buildSet();
      if(!queue?.length)throw new Error('Geen nummers gevonden voor de radioset.');

      // Belangrijk voor iPhone: eerst alle web-audio volledig laten eindigen.
      if($('jingles')?.checked&&typeof speakText==='function'){
        await speakText('Josh FM. Jouw muziek, jouw radioshow.',true).catch(()=>{});
        await wait(450);
      }

      // Start daarna pas Spotify met de samengestelde radioset.
      const uris=queue.slice(0,30).map(x=>x.uri).filter(Boolean);
      await api('/me/player/play',{method:'PUT',body:{uris}});
      await wait(700);

      // iOS/Spotify Connect kan de eerste play na TTS negeren: controleer en forceer hervatten.
      let state=null;
      try{state=await api('/me/player')}catch{}
      if(!state?.is_playing){
        const ok=await forceSpotifyPlaying();
        if(!ok)throw new Error('Spotify reageert niet op afspelen. Open Spotify één keer en probeer opnieuw.');
      }

      session=[];
      try{renderHistory()}catch{}
      try{scheduleTalk()}catch{}
      try{await refresh()}catch{}
      try{startPolling()}catch{}
      const q=$('queueInfo');
      if(q)q.textContent=`Josh FM speelt · ${queue.length} tracks in de radioset.`;
    }catch(e){
      console.error('Josh FM start error',e);
      const q=$('queueInfo');
      if(q)q.textContent='Starten lukte niet: '+String(e?.message||e||'Onbekende fout');
    }finally{
      if(btn)btn.disabled=false;
    }
  }

  const next=$('next');
  if(next)next.onclick=()=>safeNext();
  const start=$('start');
  if(start)start.onclick=()=>safeStart();

  ensureValidSource();
})();
