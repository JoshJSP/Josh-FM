// DJ NU: prepare the break while the song plays, let iOS audio focus interrupt naturally,
// then explicitly start the exact next Josh FM track. Do not hard-pause Spotify before TTS:
// on iPhone that can make the Connect device disappear after web audio takes focus.
(()=>{
  const btn=document.getElementById('djNow');if(!btn)return;
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  let armedId='',armedTrack=null,targetTrack=null,prepared=null,prepToken=0,running=false,polling=false;
  function setArmed(on){btn.dataset.queued=on?'1':'0';const b=btn.querySelector('b'),s=btn.querySelector('span');if(b)b.textContent=on?'🎙️ DJ staat klaar':'🎙️ DJ nu';if(s)s.textContent=on?'Praat na dit nummer':'Laat hem iets vertellen'}
  function exactNext(currentId){try{const q=Array.isArray(queue)?queue:[];const i=q.findIndex(t=>t.id===currentId);if(i>=0&&q[i+1])return q[i+1];const u=window.jfmUpcoming?.();return u?.[0]||null}catch{return null}}
  async function live(){try{return await api('/me/player')}catch{return null}}
  async function prepare(){const t=armedTrack;if(!t)return;const token=++prepToken;try{const[fact,weather]=await Promise.all([getFact(t),getWeather()]);const text=await makeDJScript(t,fact,weather,true);if(token!==prepToken||armedId!==t.id)return;prepared={text,fact,weather};try{await window.prepareSpeech?.(text,false)}catch{}}catch(e){console.warn('DJ voorbereiding',e)}}
  btn.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();if(running||djBusy||!playback?.item?.id)return;if(armedId===playback.item.id){armedId='';armedTrack=null;targetTrack=null;prepared=null;prepToken++;setArmed(false);return}armedId=playback.item.id;armedTrack=trackObj(playback.item);targetTrack=exactNext(armedId);prepared=null;setArmed(true);prepare()},true);
  async function forceTarget(uri){if(!uri)return false;for(let attempt=0;attempt<4;attempt++){
      let ok=false;try{if(window.JFMPlayback?.playUri)ok=await window.JFMPlayback.playUri(uri);else if(window.jfmPlayUri)ok=await window.jfmPlayUri(uri)}catch{}
      await wait(350+attempt*250);const s=await live();if(s?.is_playing&&s.item?.uri===uri){playback=s;try{renderPlayback(s)}catch{};return true}
      // Re-acquire/transfer the remembered phone before retrying the exact URI.
      try{await window.JFMPlayback?.ensureDevice?.(false)}catch{}
      if(ok&&s?.is_playing)return true;
    }return false}
  async function run(naturalNext=null){if(running||!armedId||!armedTrack)return;running=true;djBusy=true;const ended=armedTrack;let target=targetTrack||exactNext(armedId);if(naturalNext?.uri&&naturalNext.id!==ended.id)target=trackObj(naturalNext);armedId='';armedTrack=null;targetTrack=null;setArmed(false);try{let pack=prepared;prepared=null;if(!pack){const[fact,weather]=await Promise.all([getFact(ended),getWeather()]);pack={text:await makeDJScript(ended,fact,weather,true),fact,weather}}const text=pack.text||'';const d=document.getElementById('djText');if(d)d.textContent=text;document.getElementById('factSource')?.classList.add('hidden');
      // Do NOT call Spotify pause here. Starting the speech itself takes audio focus on iPhone,
      // while keeping Spotify's Connect session recoverable.
      await speakText(text,false);await wait(100);
      const uri=target?.uri||exactNext(ended.id)?.uri||null;const ok=await forceTarget(uri);
      const q=document.getElementById('queueInfo');if(ok){if(q)q.textContent='DJ klaar · muziek speelt verder.'}else if(q)q.textContent='DJ klaar, maar Spotify kon het volgende nummer niet automatisch starten.';
      try{scheduleTalk()}catch{};setTimeout(()=>refresh().catch(()=>{}),350)
    }catch(e){console.warn('DJ NU',e);try{await forceTarget(target?.uri||null)}catch{}}finally{djBusy=false;running=false}}
  setInterval(async()=>{if(polling||running||!armedId)return;polling=true;try{const s=await live();if(!s?.item)return;playback=s;try{renderPlayback(s)}catch{};if(s.item.id!==armedId){await run(s.item);return}const dur=Number(s.item.duration_ms||armedTrack?.duration||0),left=dur-Number(s.progress_ms||0);if(s.is_playing&&dur>0&&left<=500)await run()}finally{polling=false}},400);
})();