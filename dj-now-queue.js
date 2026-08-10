// DJ NU: queue a break for the end of the current track, then start the exact planned next URI.
(()=>{
  const btn=document.getElementById('djNow');if(!btn)return;
  let armedForId=null,armedTrack=null,plannedNext=null,running=false,lastLiveCheck=0;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const setState=armed=>{btn.dataset.queued=armed?'1':'0';const b=btn.querySelector('b'),s=btn.querySelector('span');if(b)b.textContent=armed?'🎙️ DJ staat klaar':'🎙️ DJ nu';if(s)s.textContent=armed?'Praat na dit nummer':'Laat hem iets vertellen'};
  function getPlannedNext(){try{return window.jfmUpcoming?.()?.[0]||null}catch{return null}}
  btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();if(!playback?.item?.id||djBusy||running)return;if(armedForId===playback.item.id){armedForId=null;armedTrack=null;plannedNext=null;setState(false);return}armedForId=playback.item.id;armedTrack=trackObj(playback.item);plannedNext=getPlannedNext();setState(true)},true);
  async function state(){try{return await api('/me/player')}catch{return null}}
  async function forceStartNext(outgoingId,nextTrack){
    // Give iOS a moment to release the DJ audio session.
    await sleep(850);
    if(nextTrack?.uri){
      // Starting a concrete URI is much more reliable than next+play after TTS on iPhone.
      for(let i=0;i<4;i++){
        await api('/me/player/play',{method:'PUT',body:{uris:[nextTrack.uri]}}).catch(()=>{});
        await sleep(750+i*250);
        const s=await state();
        if(s?.item?.id===nextTrack.id&&s.is_playing){playback=s;renderPlayback(s);return true}
        if(s?.item?.uri===nextTrack.uri&&s.is_playing){playback=s;renderPlayback(s);return true}
      }
    }
    // Fallback if internal queue had no usable next URI.
    await api('/me/player/next',{method:'POST'}).catch(()=>{});await sleep(500);
    for(let i=0;i<3;i++){
      await api('/me/player/play',{method:'PUT'}).catch(()=>{});await sleep(800);
      const s=await state();if(s?.item?.id&&s.item.id!==outgoingId&&s.is_playing){playback=s;renderPlayback(s);return true}
    }
    return false;
  }
  async function run(){if(running||!armedForId||!armedTrack)return;running=true;djBusy=true;const ended=armedTrack,outgoingId=armedForId,nextTrack=plannedNext||getPlannedNext();armedForId=null;armedTrack=null;plannedNext=null;setState(false);try{
      await api('/me/player/pause',{method:'PUT'}).catch(()=>{});
      const[fact,weather]=await Promise.all([typeof getFact==='function'?getFact(ended):null,typeof getWeather==='function'?getWeather():null]);
      const text=await makeDJScript(ended,fact,weather,true);const el=document.getElementById('djText');if(el)el.textContent=text;
      await speakText(text,false);
      const ok=await forceStartNext(outgoingId,nextTrack);
      if(!ok){console.warn('Josh FM: exact next track kon niet bevestigd worden');await api('/me/player/play',{method:'PUT'}).catch(()=>{})}
      if(typeof scheduleTalk==='function')scheduleTalk();setTimeout(()=>refresh().catch(()=>{}),700);
    }catch(e){console.warn('DJ NOW break failed',e);if(nextTrack?.uri)await api('/me/player/play',{method:'PUT',body:{uris:[nextTrack.uri]}}).catch(()=>{});else await api('/me/player/play',{method:'PUT'}).catch(()=>{})}finally{djBusy=false;running=false}}
  setInterval(async()=>{if(running||!armedForId)return;const p=playback;if(!p?.item||p.item.id!==armedForId)return;const duration=Number(p.item.duration_ms||armedTrack?.duration||0),progress=Number(p.progress_ms||0),remaining=duration-progress;if(duration&&remaining<=8000&&Date.now()-lastLiveCheck>650){lastLiveCheck=Date.now();const live=await state();if(!live?.item||live.item.id!==armedForId)return;playback=live;renderPlayback(live);const liveRemaining=Number(live.item.duration_ms||duration)-Number(live.progress_ms||0);if(live.is_playing&&liveRemaining<=1900)run()}},250);
})();