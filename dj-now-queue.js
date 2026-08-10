// DJ NU queues a manual break for the final moment of the CURRENT track.
// It pauses before Spotify can start the next song, lets the DJ speak, then explicitly skips to + starts the next song.
(()=>{
  const btn=document.getElementById('djNow');
  if(!btn)return;
  let armedForId=null,armedTrack=null,running=false;

  const setState=armed=>{
    btn.dataset.queued=armed?'1':'0';
    const b=btn.querySelector('b'),s=btn.querySelector('span');
    if(b)b.textContent=armed?'🎙️ DJ staat klaar':'🎙️ DJ nu';
    if(s)s.textContent=armed?'Praat na dit nummer':'Laat hem iets vertellen';
  };

  btn.addEventListener('click',e=>{
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    if(!playback?.item?.id||djBusy||running)return;
    if(armedForId===playback.item.id){armedForId=null;armedTrack=null;setState(false);return}
    armedForId=playback.item.id;
    armedTrack=trackObj(playback.item);
    setState(true);
  },true);

  async function runQueuedBreak(){
    if(running||!armedForId||!armedTrack)return;
    running=true;djBusy=true;
    const ended=armedTrack;
    armedForId=null;armedTrack=null;setState(false);
    try{
      // Stop the outgoing song BEFORE Spotify gets a chance to expose the next intro.
      await api('/me/player/pause',{method:'PUT'}).catch(()=>{});
      const [fact,weather]=await Promise.all([
        typeof getFact==='function'?getFact(ended):Promise.resolve(null),
        typeof getWeather==='function'?getWeather():Promise.resolve(null)
      ]);
      const text=await makeDJScript(ended,fact,weather,true);
      if(document.getElementById('djText'))document.getElementById('djText').textContent=text;
      const source=document.getElementById('factSource');
      if(source){
        if(fact){source.classList.remove('hidden');source.textContent=`Feitenbron: ${fact.source||'muziekdata'}`}
        else source.classList.add('hidden');
      }
      await speakText(text,false);

      // Move to the next track deliberately and then force playback on.
      // This avoids the iOS/Spotify state where the DJ ends but music stays paused.
      await api('/me/player/next',{method:'POST'}).catch(()=>{});
      await new Promise(r=>setTimeout(r,350));
      await api('/me/player/play',{method:'PUT'}).catch(()=>{});
      await new Promise(r=>setTimeout(r,250));
      await refresh().catch(()=>{});
      if(typeof scheduleTalk==='function')scheduleTalk();
    }catch(e){
      console.warn('Queued DJ break failed',e);
      // Last-resort recovery: never leave the radio silent.
      await api('/me/player/play',{method:'PUT'}).catch(()=>{});
    }finally{
      djBusy=false;running=false;
    }
  }

  // Check often enough to catch the last second before Spotify changes track.
  setInterval(()=>{
    if(running||!armedForId||!playback?.item)return;
    if(playback.item.id!==armedForId){
      // We missed the boundary. Do not talk over the new song; cancel instead.
      armedForId=null;armedTrack=null;setState(false);return;
    }
    const duration=Number(playback.item.duration_ms||armedTrack?.duration||0);
    const progress=Number(playback.progress_ms||0);
    const remaining=duration-progress;
    if(playback.is_playing&&duration>0&&remaining<=1600)runQueuedBreak();
  },200);
})();