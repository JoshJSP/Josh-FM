// DJ NU: prepare text + voice while the song is still playing, speak almost immediately at the end,
// then explicitly recover the iPhone Spotify device and start the planned next track.
(()=>{
  const btn=document.getElementById('djNow');if(!btn)return;
  let armedForId=null,armedTrack=null,plannedNext=null,running=false,lastLiveCheck=0,prepared=null,prepareToken=0;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const setState=armed=>{btn.dataset.queued=armed?'1':'0';const b=btn.querySelector('b'),s=btn.querySelector('span');if(b)b.textContent=armed?'🎙️ DJ staat klaar':'🎙️ DJ nu';if(s)s.textContent=armed?'Praat na dit nummer':'Laat hem iets vertellen'};
  function getPlannedNext(){try{return window.jfmUpcoming?.()?.[0]||null}catch{return null}}
  btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();if(!playback?.item?.id||djBusy||running)return;if(armedForId===playback.item.id){armedForId=null;armedTrack=null;plannedNext=null;prepared=null;prepareToken++;setState(false);return}armedForId=playback.item.id;armedTrack=trackObj(playback.item);plannedNext=getPlannedNext();prepared=null;setState(true);prepareBreak()},true);
  async function state(){try{return await api('/me/player')}catch{return null}}
  async function prepareBreak(){if(!armedTrack)return;const token=++prepareToken,ended=armedTrack;try{const[fact,weather]=await Promise.all([typeof getFact==='function'?getFact(ended):null,typeof getWeather==='function'?getWeather():null]);const text=await makeDJScript(ended,fact,weather,true);if(token!==prepareToken||armedForId!==ended.id)return;prepared={text,fact,weather};if(typeof window.prepareSpeech==='function')await window.prepareSpeech(text,false)}catch(e){console.warn('DJ voorbereiding mislukt',e)}}
  async function startNext(outgoingId,nextTrack){
    if(typeof window.jfmPlayUri==='function'){
      const ok=await window.jfmPlayUri(nextTrack?.uri||null);
      if(ok)return true;
    }
    // Fallback for browsers/devices where recovery helper is unavailable.
    try{if(typeof window.jfmEnsureSpotifyDevice==='function')await window.jfmEnsureSpotifyDevice(false)}catch{}
    for(let i=0;i<3;i++){
      try{if(nextTrack?.uri)await api('/me/player/play',{method:'PUT',body:{uris:[nextTrack.uri]}});else await api('/me/player/next',{method:'POST'})}catch{}
      await sleep(500+i*300);
      try{const s=await state();if(s?.is_playing&&s.item?.id!==outgoingId){playback=s;renderPlayback(s);return true}}catch{}
    }
    return false;
  }
  async function run(){if(running||!armedForId||!armedTrack)return;running=true;djBusy=true;const ended=armedTrack,outgoingId=armedForId,nextTrack=plannedNext||getPlannedNext();armedForId=null;armedTrack=null;plannedNext=null;setState(false);try{
      let pack=prepared;prepared=null;
      if(!pack){const[fact,weather]=await Promise.all([typeof getFact==='function'?getFact(ended):null,typeof getWeather==='function'?getWeather():null]);const text=await makeDJScript(ended,fact,weather,true);pack={text,fact,weather};if(typeof window.prepareSpeech==='function')await window.prepareSpeech(text,false)}
      const el=document.getElementById('djText');if(el)el.textContent=pack.text;
      const source=document.getElementById('factSource');if(source)source.classList.add('hidden');
      // Only pause once the voice is already generated, so there is almost no dead air.
      await api('/me/player/pause',{method:'PUT'}).catch(()=>{});
      await speakText(pack.text,false);
      const ok=await startNext(outgoingId,nextTrack);
      if(!ok){const q=document.getElementById('queueInfo');if(q)q.textContent='Spotify verloor het actieve apparaat na de DJ-break.'}
      if(typeof scheduleTalk==='function')scheduleTalk();setTimeout(()=>refresh().catch(()=>{}),450);
    }catch(e){console.warn('DJ NOW break failed',e);await startNext(outgoingId,nextTrack)}finally{djBusy=false;running=false}}
  setInterval(async()=>{if(running||!armedForId)return;const p=playback;if(!p?.item||p.item.id!==armedForId)return;const duration=Number(p.item.duration_ms||armedTrack?.duration||0),progress=Number(p.progress_ms||0),remaining=duration-progress;if(duration&&remaining<=7000&&Date.now()-lastLiveCheck>500){lastLiveCheck=Date.now();const live=await state();if(!live?.item||live.item.id!==armedForId)return;playback=live;renderPlayback(live);const liveRemaining=Number(live.item.duration_ms||duration)-Number(live.progress_ms||0);if(live.is_playing&&liveRemaining<=450)run()}},180);
})();