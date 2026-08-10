// DJ NU: prepare the break while the song plays. Spotify keeps running underneath the DJ,
// softly ducked like real radio, so iPhone never has to recover playback after the voice.
(()=>{
  const btn=document.getElementById('djNow');if(!btn)return;
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  let armedId='',armedTrack=null,prepared=null,prepToken=0,running=false,polling=false;
  function setArmed(on){btn.dataset.queued=on?'1':'0';const b=btn.querySelector('b'),s=btn.querySelector('span');if(b)b.textContent=on?'🎙️ DJ staat klaar':'🎙️ DJ nu';if(s)s.textContent=on?'Praat na dit nummer':'Laat hem iets vertellen'}
  async function live(){try{return await api('/me/player')}catch{return null}}
  async function prepare(){const t=armedTrack;if(!t)return;const token=++prepToken;try{const[fact,weather]=await Promise.all([getFact(t),getWeather()]);const text=await makeDJScript(t,fact,weather,true);if(token!==prepToken||armedId!==t.id)return;prepared={text,fact,weather};try{await window.prepareSpeech?.(text,false)}catch{}}catch(e){console.warn('DJ voorbereiding',e)}}
  btn.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();if(running||djBusy||!playback?.item?.id)return;if(armedId===playback.item.id){armedId='';armedTrack=null;prepared=null;prepToken++;setArmed(false);return}armedId=playback.item.id;armedTrack=trackObj(playback.item);prepared=null;setArmed(true);prepare()},true);
  async function setMusicVolume(v){try{const p=window.jfmSpotifyPlayer;if(p?.setVolume){await p.setVolume(v);return true}}catch{}return false}
  async function ensureStillPlaying(){try{const p=window.jfmSpotifyPlayer;if(p){const s=await p.getCurrentState();if(s?.paused)await p.resume();return}}catch{}try{const s=await live();if(s&&!s.is_playing)await api('/me/player/play',{method:'PUT'})}catch{}}
  async function run(){if(running||!armedId||!armedTrack)return;running=true;djBusy=true;const ended=armedTrack;armedId='';armedTrack=null;setArmed(false);try{let pack=prepared;prepared=null;if(!pack){const[fact,weather]=await Promise.all([getFact(ended),getWeather()]);pack={text:await makeDJScript(ended,fact,weather,true),fact,weather}}const text=pack.text||'';const d=document.getElementById('djText');if(d)d.textContent=text;document.getElementById('factSource')?.classList.add('hidden');
      await setMusicVolume(.12);await wait(50);await speakText(text,false);await wait(60);await setMusicVolume(1);await ensureStillPlaying();
      const q=document.getElementById('queueInfo');if(q)q.textContent='DJ klaar · muziek loopt door.';try{scheduleTalk()}catch{};setTimeout(()=>refresh().catch(()=>{}),300)
    }catch(e){console.warn('DJ NU',e);try{await setMusicVolume(1);await ensureStillPlaying()}catch{}}finally{djBusy=false;running=false}}
  setInterval(async()=>{if(polling||running||!armedId)return;polling=true;try{const s=await live();if(!s?.item)return;playback=s;try{renderPlayback(s)}catch{};if(s.item.id!==armedId){await run();return}const dur=Number(s.item.duration_ms||armedTrack?.duration||0),left=dur-Number(s.progress_ms||0);if(s.is_playing&&dur>0&&left<=650)await run()}finally{polling=false}},400);
})();

// Automatic scheduled DJ breaks use the exact same radio-style ducking approach.
(()=>{
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  async function volume(v){try{const p=window.jfmSpotifyPlayer;if(p?.setVolume){await p.setVolume(v);return true}}catch{}return false}
  async function alive(){try{const p=window.jfmSpotifyPlayer;if(!p)return;const s=await p.getCurrentState();if(s?.paused)await p.resume()}catch{}}
  window.djBreak=djBreak=async function(track=null,manual=false){if(djBusy)return;djBusy=true;try{const target=track||(playback?.item?trackObj(playback.item):null);const[fact,weather]=await Promise.all([getFact(target),getWeather()]);const text=await makeDJScript(target,fact,weather,manual);const el=document.getElementById('djText');if(el)el.textContent=text;document.getElementById('factSource')?.classList.add('hidden');await volume(.12);await wait(50);if(document.getElementById('jingles')?.checked&&Math.random()<.18&&!manual){try{await speakText('Josh FM.',true)}catch{}}await speakText(text,false);await wait(60);await volume(1);await alive()}catch(e){console.warn('Automatische DJ-break',e);try{await volume(1);await alive()}catch{}}finally{djBusy=false}};
})();