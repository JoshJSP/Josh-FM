// DJ NU: prepare text + voice while the song is still playing, then trigger from LIVE Spotify state.
// Important: iPhone does not continuously update playback.progress_ms in our cached object, so we poll Spotify directly.
(()=>{
  const btn=document.getElementById('djNow');if(!btn)return;
  let armedForId=null,armedTrack=null,plannedNext=null,running=false,prepared=null,prepareToken=0,pollBusy=false;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const setState=armed=>{btn.dataset.queued=armed?'1':'0';const b=btn.querySelector('b'),s=btn.querySelector('span');if(b)b.textContent=armed?'🎙️ DJ staat klaar':'🎙️ DJ nu';if(s)s.textContent=armed?'Praat na dit nummer':'Laat hem iets vertellen'};
  function getPlannedNext(){try{return window.jfmUpcoming?.()?.[0]||null}catch{return null}}
  async function state(){try{return await api('/me/player')}catch{return null}}

  btn.addEventListener('click',e=>{
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    if(!playback?.item?.id||djBusy||running)return;
    if(armedForId===playback.item.id){armedForId=null;armedTrack=null;plannedNext=null;prepared=null;prepareToken++;setState(false);return}
    armedForId=playback.item.id;armedTrack=trackObj(playback.item);plannedNext=getPlannedNext();prepared=null;setState(true);prepareBreak();
  },true);

  async function prepareBreak(){
    if(!armedTrack)return;const token=++prepareToken,ended=armedTrack;
    try{
      const[fact,weather]=await Promise.all([typeof getFact==='function'?getFact(ended):null,typeof getWeather==='function'?getWeather():null]);
      const text=await makeDJScript(ended,fact,weather,true);
      if(token!==prepareToken||armedForId!==ended.id)return;
      prepared={text,fact,weather};
      if(typeof window.prepareSpeech==='function')await window.prepareSpeech(text,false);
    }catch(e){console.warn('DJ voorbereiding mislukt',e)}
  }

  async function startSpecific(uri){
    if(typeof window.jfmPlayUri==='function'&&uri){const ok=await window.jfmPlayUri(uri);if(ok)return true}
    try{if(typeof window.jfmEnsureSpotifyDevice==='function')await window.jfmEnsureSpotifyDevice(false)}catch{}
    for(let i=0;i<4;i++){
      try{await api('/me/player/play',{method:'PUT',body:uri?{uris:[uri]}:undefined})}catch{}
      await sleep(450+i*250);
      const s=await state();if(s?.is_playing){playback=s;try{renderPlayback(s)}catch{};return true}
    }
    return false;
  }

  async function run(options={}){
    if(running||!armedForId||!armedTrack)return;
    running=true;djBusy=true;
    const ended=armedTrack,outgoingId=armedForId;
    const naturalNext=options.naturalNext||null;
    const nextTrack=naturalNext?trackObj(naturalNext):(plannedNext||getPlannedNext());
    armedForId=null;armedTrack=null;plannedNext=null;setState(false);
    try{
      let pack=prepared;prepared=null;
      if(!pack){
        const[fact,weather]=await Promise.all([typeof getFact==='function'?getFact(ended):null,typeof getWeather==='function'?getWeather():null]);
        const text=await makeDJScript(ended,fact,weather,true);pack={text,fact,weather};
        if(typeof window.prepareSpeech==='function')await window.prepareSpeech(text,false);
      }
      const el=document.getElementById('djText');if(el)el.textContent=pack.text;
      const source=document.getElementById('factSource');if(source)source.classList.add('hidden');

      // Pause at the boundary. If Spotify already advanced naturally, this stops the intro almost immediately.
      await api('/me/player/pause',{method:'PUT'}).catch(()=>{});
      await speakText(pack.text,false);

      // If Spotify already advanced, restart that same track; otherwise start the planned next one.
      const targetUri=naturalNext?.uri||nextTrack?.uri||null;
      const ok=await startSpecific(targetUri);
      if(!ok){const q=document.getElementById('queueInfo');if(q)q.textContent='Spotify kon na de DJ-break niet automatisch hervatten.'}
      if(typeof scheduleTalk==='function')scheduleTalk();setTimeout(()=>refresh().catch(()=>{}),450);
    }catch(e){console.warn('DJ NOW break failed',e);await startSpecific(nextTrack?.uri||null)}
    finally{djBusy=false;running=false}
  }

  // Poll Spotify's REAL player state while armed. This is intentionally independent of cached progress_ms.
  setInterval(async()=>{
    if(pollBusy||running||!armedForId)return;
    pollBusy=true;
    try{
      const live=await state();if(!live?.item)return;
      playback=live;try{renderPlayback(live)}catch{}

      // Best case: catch the final ~1.2 seconds before Spotify advances.
      if(live.item.id===armedForId){
        const duration=Number(live.item.duration_ms||armedTrack?.duration||0);
        const remaining=duration-Number(live.progress_ms||0);
        if(live.is_playing&&duration>0&&remaining<=1200){await run();return}
      }

      // Fallback: Spotify advanced between polls. Still do the break instead of leaving 'DJ staat klaar' forever.
      if(live.item.id!==armedForId){
        await run({naturalNext:live.item});
      }
    }finally{pollBusy=false}
  },650);
})();