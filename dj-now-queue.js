// DJ NU queues a manual break for the final moment of the CURRENT track.
// It pauses before Spotify can start the next song, lets the DJ speak, then verifies that the next song is REALLY playing.
(()=>{
  const btn=document.getElementById('djNow');
  if(!btn)return;
  let armedForId=null,armedTrack=null,running=false;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

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
    armedForId=playback.item.id;armedTrack=trackObj(playback.item);setState(true);
  },true);

  async function getState(){try{return await api('/me/player')}catch{return null}}

  async function startNextAndVerify(outgoingId){
    // Advance exactly once. Spotify may accept this while still paused.
    await api('/me/player/next',{method:'POST'}).catch(()=>{});
    await sleep(650);

    // Explicitly start playback, then verify against Spotify's real state.
    for(let attempt=0;attempt<4;attempt++){
      await api('/me/player/play',{method:'PUT'}).catch(()=>{});
      await sleep(attempt===0?700:1000);
      let state=await getState();
      if(state?.item?.id && state.item.id!==outgoingId && state.is_playing){
        playback=state;renderPlayback(state);return true;
      }

      // If Spotify did not advance, ask for next again once, then retry play.
      if(attempt===1 && (!state?.item?.id || state.item.id===outgoingId)){
        await api('/me/player/next',{method:'POST'}).catch(()=>{});
        await sleep(600);
      }
    }

    // Last recovery: resume whatever Spotify currently has selected.
    await api('/me/player/play',{method:'PUT'}).catch(()=>{});
    await sleep(900);
    const finalState=await getState();
    if(finalState){playback=finalState;renderPlayback(finalState)}
    return !!finalState?.is_playing;
  }

  async function runQueuedBreak(){
    if(running||!armedForId||!armedTrack)return;
    running=true;djBusy=true;
    const ended=armedTrack,outgoingId=armedForId;
    armedForId=null;armedTrack=null;setState(false);
    try{
      await api('/me/player/pause',{method:'PUT'}).catch(()=>{});
      const [fact,weather]=await Promise.all([
        typeof getFact==='function'?getFact(ended):Promise.resolve(null),
        typeof getWeather==='function'?getWeather():Promise.resolve(null)
      ]);
      const text=await makeDJScript(ended,fact,weather,true);
      if(document.getElementById('djText'))document.getElementById('djText').textContent=text;
      const source=document.getElementById('factSource');
      if(source){if(fact){source.classList.remove('hidden');source.textContent=`Feitenbron: ${fact.source||'muziekdata'}`}else source.classList.add('hidden')}
      await speakText(text,false);

      const resumed=await startNextAndVerify(outgoingId);
      if(!resumed)console.warn('Josh FM: Spotify bevestigde hervatten niet.');
      if(typeof scheduleTalk==='function')scheduleTalk();
      setTimeout(()=>refresh().catch(()=>{}),600);
    }catch(e){
      console.warn('Queued DJ break failed',e);
      await api('/me/player/play',{method:'PUT'}).catch(()=>{});
    }finally{djBusy=false;running=false}
  }

  setInterval(()=>{
    if(running||!armedForId||!playback?.item)return;
    if(playback.item.id!==armedForId){armedForId=null;armedTrack=null;setState(false);return}
    const duration=Number(playback.item.duration_ms||armedTrack?.duration||0),progress=Number(playback.progress_ms||0),remaining=duration-progress;
    if(playback.is_playing&&duration>0&&remaining<=1600)runQueuedBreak();
  },200);
})();