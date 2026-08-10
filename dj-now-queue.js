// DJ NU: prepare the break while the song plays, then restart the exact next Josh FM track
// on the SAME remembered Spotify device that was active before the DJ voice took audio focus.
(()=>{
  const btn=document.getElementById('djNow');if(!btn)return;
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  let armedId='',armedTrack=null,targetTrack=null,deviceBefore='',prepared=null,prepToken=0,running=false,polling=false;
  function setArmed(on){btn.dataset.queued=on?'1':'0';const b=btn.querySelector('b'),s=btn.querySelector('span');if(b)b.textContent=on?'🎙️ DJ staat klaar':'🎙️ DJ nu';if(s)s.textContent=on?'Praat na dit nummer':'Laat hem iets vertellen'}
  function exactNext(currentId){try{const q=Array.isArray(queue)?queue:[];const i=q.findIndex(t=>t.id===currentId);if(i>=0&&q[i+1])return q[i+1];const u=window.jfmUpcoming?.();return u?.[0]||null}catch{return null}}
  async function live(){try{return await api('/me/player')}catch{return null}}
  async function rememberCurrentDevice(){try{const s=await live();return s?.device?.id||window.JFMPlayback?.storedDevice?.()||''}catch{return window.JFMPlayback?.storedDevice?.()||''}}
  async function prepare(){const t=armedTrack;if(!t)return;const token=++prepToken;try{const[fact,weather]=await Promise.all([getFact(t),getWeather()]);const text=await makeDJScript(t,fact,weather,true);if(token!==prepToken||armedId!==t.id)return;prepared={text,fact,weather};try{await window.prepareSpeech?.(text,false)}catch{}}catch(e){console.warn('DJ voorbereiding',e)}}
  btn.addEventListener('click',async e=>{e.preventDefault();e.stopImmediatePropagation();if(running||djBusy||!playback?.item?.id)return;if(armedId===playback.item.id){armedId='';armedTrack=null;targetTrack=null;deviceBefore='';prepared=null;prepToken++;setArmed(false);return}armedId=playback.item.id;armedTrack=trackObj(playback.item);targetTrack=exactNext(armedId);deviceBefore=await rememberCurrentDevice();prepared=null;setArmed(true);prepare()},true);

  async function forceTarget(uri,preferredDevice){
    if(!uri)return false;
    // Give iOS a short moment to release the DJ audio session before asking Spotify to own audio again.
    await wait(280);
    if(window.JFMPlayback?.hardPlay){const ok=await window.JFMPlayback.hardPlay(uri,preferredDevice||'');if(ok)return true}
    for(let attempt=0;attempt<3;attempt++){
      let id=preferredDevice||window.JFMPlayback?.storedDevice?.()||'';
      if(!id)try{id=await window.JFMPlayback?.chooseDevice?.()}catch{}
      if(id)try{await window.JFMPlayback?.transfer?.(id,false)}catch{}
      try{await api('/me/player/play'+(id?'?device_id='+encodeURIComponent(id):''),{method:'PUT',body:{uris:[uri]}})}catch{}
      await wait(500+attempt*250);const s=await live();if(s?.is_playing&&s.item?.uri===uri){playback=s;try{renderPlayback(s)}catch{};return true}
    }
    return false;
  }

  async function run(naturalNext=null){
    if(running||!armedId||!armedTrack)return;
    running=true;djBusy=true;
    const ended=armedTrack,preferredDevice=deviceBefore||window.JFMPlayback?.storedDevice?.()||'';
    let target=targetTrack||exactNext(armedId);if(naturalNext?.uri&&naturalNext.id!==ended.id)target=trackObj(naturalNext);
    armedId='';armedTrack=null;targetTrack=null;deviceBefore='';setArmed(false);
    try{
      let pack=prepared;prepared=null;if(!pack){const[fact,weather]=await Promise.all([getFact(ended),getWeather()]);pack={text:await makeDJScript(ended,fact,weather,true),fact,weather}}
      const text=pack.text||'';const d=document.getElementById('djText');if(d)d.textContent=text;document.getElementById('factSource')?.classList.add('hidden');
      await speakText(text,false);
      const uri=target?.uri||exactNext(ended.id)?.uri||null;
      const ok=await forceTarget(uri,preferredDevice);
      const q=document.getElementById('queueInfo');if(ok){if(q)q.textContent='DJ klaar · muziek speelt verder.'}else if(q)q.textContent='DJ klaar · Spotify kon je iPhone niet automatisch opnieuw activeren.';
      try{scheduleTalk()}catch{};setTimeout(()=>refresh().catch(()=>{}),400)
    }catch(e){console.warn('DJ NU',e);try{await forceTarget(target?.uri||null,preferredDevice)}catch{}}finally{djBusy=false;running=false}
  }

  setInterval(async()=>{if(polling||running||!armedId)return;polling=true;try{const s=await live();if(!s?.item)return;playback=s;try{renderPlayback(s)}catch{};if(s.item.id!==armedId){await run(s.item);return}const dur=Number(s.item.duration_ms||armedTrack?.duration||0),left=dur-Number(s.progress_ms||0);if(s.is_playing&&dur>0&&left<=500)await run()}finally{polling=false}},400);
})();