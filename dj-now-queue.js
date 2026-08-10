// DJ NU: prepare the break before track end, speak at the boundary, then resume Spotify reliably.
(()=>{
  const btn=document.getElementById('djNow');if(!btn)return;
  let armedForId=null,armedTrack=null,plannedNext=null,running=false,lastLiveCheck=0,prepared=null;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const setState=armed=>{btn.dataset.queued=armed?'1':'0';const b=btn.querySelector('b'),s=btn.querySelector('span');if(b)b.textContent=armed?'🎙️ DJ staat klaar':'🎙️ DJ nu';if(s)s.textContent=armed?'Praat na dit nummer':'Laat hem iets vertellen'};
  function getPlannedNext(){try{return window.jfmUpcoming?.()?.[0]||null}catch{return null}}
  btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();if(!playback?.item?.id||djBusy||running)return;if(armedForId===playback.item.id){armedForId=null;armedTrack=null;plannedNext=null;prepared=null;setState(false);return}armedForId=playback.item.id;armedTrack=trackObj(playback.item);plannedNext=getPlannedNext();prepared=null;setState(true);prepareBreak()},true);
  async function state(){try{return await api('/me/player')}catch{return null}}
  async function prepareBreak(){if(!armedTrack)return;try{const ended=armedTrack;const[fact,weather]=await Promise.all([typeof getFact==='function'?getFact(ended):null,typeof getWeather==='function'?getWeather():null]);const text=await makeDJScript(ended,fact,weather,true);if(armedForId===ended.id)prepared={text,fact,weather}}catch{}}
  async function activeDeviceId(){try{const d=await api('/me/player/devices');const devices=d?.devices||[];return(devices.find(x=>x.is_active)||devices.find(x=>x.type==='Smartphone')||devices[0])?.id||''}catch{return''}}
  async function forceStartNext(outgoingId,nextTrack){
    // Spotify may report no active device after iOS gives audio focus to TTS. Re-acquire the phone first.
    for(let attempt=0;attempt<5;attempt++){
      const deviceId=await activeDeviceId();
      const suffix=deviceId?`?device_id=${encodeURIComponent(deviceId)}`:'';
      try{
        if(nextTrack?.uri)await api('/me/player/play'+suffix,{method:'PUT',body:{uris:[nextTrack.uri]}});
        else await api('/me/player/play'+suffix,{method:'PUT'});
      }catch(e){
        if(/No active device/i.test(e?.message||'')){await sleep(300);continue}
      }
      await sleep(350+attempt*150);
      const s=await state();
      if(s?.is_playing&&(!nextTrack||s.item?.id===nextTrack.id||s.item?.uri===nextTrack.uri||s.item?.id!==outgoingId)){playback=s;renderPlayback(s);return true}
    }
    return false;
  }
  async function run(){if(running||!armedForId||!armedTrack)return;running=true;djBusy=true;const ended=armedTrack,outgoingId=armedForId,nextTrack=plannedNext||getPlannedNext();armedForId=null;armedTrack=null;plannedNext=null;setState(false);try{
      // Script/facts are normally already prepared while music is playing, so silence is almost immediate.
      const pack=prepared;prepared=null;
      await api('/me/player/pause',{method:'PUT'}).catch(()=>{});
      let text=pack?.text;
      if(!text){const[fact,weather]=await Promise.all([typeof getFact==='function'?getFact(ended):null,typeof getWeather==='function'?getWeather():null]);text=await makeDJScript(ended,fact,weather,true)}
      const el=document.getElementById('djText');if(el)el.textContent=text;
      await speakText(text,false);
      const ok=await forceStartNext(outgoingId,nextTrack);
      if(!ok)console.warn('Josh FM: Spotify heeft na DJ-break geen actief afspeelapparaat bevestigd');
      if(typeof scheduleTalk==='function')scheduleTalk();setTimeout(()=>refresh().catch(()=>{}),450);
    }catch(e){console.warn('DJ NOW break failed',e);await forceStartNext(outgoingId,nextTrack)}finally{djBusy=false;running=false}}
  setInterval(async()=>{if(running||!armedForId)return;const p=playback;if(!p?.item||p.item.id!==armedForId)return;const duration=Number(p.item.duration_ms||armedTrack?.duration||0),progress=Number(p.progress_ms||0),remaining=duration-progress;if(duration&&remaining<=8000&&Date.now()-lastLiveCheck>550){lastLiveCheck=Date.now();const live=await state();if(!live?.item||live.item.id!==armedForId)return;playback=live;renderPlayback(live);const liveRemaining=Number(live.item.duration_ms||duration)-Number(live.progress_ms||0);if(live.is_playing&&liveRemaining<=650)run()}},200);
})();