// Josh FM DJ transitions: absolutely no audible music under the DJ.
// Mute first, confirm Spotify is paused, speak, then start one exact URI from 0:00.
(()=>{
  const btn=document.getElementById('djNow');if(!btn)return;
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  let armedId='',armedTrack=null,targetUri='',prepared=null,prepToken=0,running=false,polling=false;
  const player=()=>window.jfmSpotifyPlayer||null;
  function setArmed(on){btn.dataset.queued=on?'1':'0';const b=btn.querySelector('b'),s=btn.querySelector('span');if(b)b.textContent=on?'🎙️ DJ staat klaar':'🎙️ DJ nu';if(s)s.textContent=on?'Praat na dit nummer':'Laat hem iets vertellen'}
  async function live(){try{return await api('/me/player')}catch{return null}}
  function exactNext(id){try{const q=Array.isArray(queue)?queue:[];const i=q.findIndex(t=>t.id===id);if(i>=0&&q[i+1]?.uri)return q[i+1].uri;return window.jfmUpcoming?.()?.[0]?.uri||''}catch{return''}}
  async function prepare(){const t=armedTrack;if(!t)return;const token=++prepToken;try{const[fact,weather]=await Promise.all([getFact(t),getWeather()]);const text=await makeDJScript(t,fact,weather,true);if(token!==prepToken||armedId!==t.id)return;prepared={text,fact,weather};try{await window.prepareSpeech?.(text,false)}catch{}}catch(e){console.warn('DJ voorbereiding',e)}}
  btn.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();if(running||djBusy||!playback?.item?.id)return;if(armedId===playback.item.id){armedId='';armedTrack=null;targetUri='';prepared=null;prepToken++;setArmed(false);return}armedId=playback.item.id;armedTrack=trackObj(playback.item);targetUri=exactNext(armedId);prepared=null;setArmed(true);prepare()},true);

  async function mute(){try{await player()?.setVolume(0)}catch{}}
  async function fullVolume(){try{await player()?.setVolume(1)}catch{}}
  async function pauseConfirmed(){
    await mute();
    for(let i=0;i<6;i++){
      try{await player()?.pause()}catch{}
      try{await api('/me/player/pause',{method:'PUT'})}catch{}
      await wait(90+i*35);
      try{const s=await player()?.getCurrentState();if(s?.paused)return true}catch{}
      try{const s=await live();if(s&&!s.is_playing)return true}catch{}
    }
    // Even if iOS does not acknowledge pause, volume is still zero, so the DJ remains clean.
    return false;
  }
  async function playExact(uri){
    if(!uri)return false;
    const p=player();
    const id=localStorage.getItem('jfm_spotify_device_id')||'';
    for(let i=0;i<5;i++){
      try{if(id)await api('/me/player/play?device_id='+encodeURIComponent(id),{method:'PUT',body:{uris:[uri],position_ms:0}});else await api('/me/player/play',{method:'PUT',body:{uris:[uri],position_ms:0}})}catch{}
      await wait(170+i*90);
      try{const s=await p?.getCurrentState();const cur=s?.track_window?.current_track;if(cur?.uri===uri){if(s.paused)await p.resume();await p.seek(0).catch(()=>{});await fullVolume();return true}}catch{}
      const s=await live();if(s?.item?.uri===uri){if(!s.is_playing)try{await api('/me/player/play',{method:'PUT'})}catch{};try{await api('/me/player/seek?position_ms=0',{method:'PUT'})}catch{};await fullVolume();return true}
    }
    await fullVolume();return false;
  }

  async function run(){
    if(running||!armedId||!armedTrack)return;
    running=true;djBusy=true;
    const ended=armedTrack,uri=targetUri||exactNext(armedId);
    armedId='';armedTrack=null;targetUri='';setArmed(false);
    try{
      // Silence first, then pause. This guarantees the DJ never competes with music.
      await pauseConfirmed();
      let pack=prepared;prepared=null;if(!pack){const[fact,weather]=await Promise.all([getFact(ended),getWeather()]);pack={text:await makeDJScript(ended,fact,weather,true),fact,weather}}
      const text=pack.text||'';const d=document.getElementById('djText');if(d)d.textContent=text;document.getElementById('factSource')?.classList.add('hidden');
      await speakText(text,false);
      await wait(90);
      const ok=await playExact(uri);
      const q=document.getElementById('queueInfo');if(q)q.textContent=ok?'DJ klaar · volgend nummer start vanaf het begin.':'DJ klaar · afspelen kon niet automatisch worden hervat.';
      try{scheduleTalk()}catch{};setTimeout(()=>refresh().catch(()=>{}),350)
    }catch(e){console.warn('DJ NU',e);try{await playExact(uri)}catch{}finally{await fullVolume()}}finally{djBusy=false;running=false}
  }

  // Stop with enough margin before Spotify's natural transition.
  setInterval(async()=>{if(polling||running||!armedId)return;polling=true;try{const s=await live();if(!s?.item)return;playback=s;try{renderPlayback(s)}catch{};
    if(s.item.id!==armedId){
      // Spotify already crossed the boundary: silence it immediately. The target remains the URI
      // captured when DJ NU was armed, so we never accidentally skip another song.
      await mute();await pauseConfirmed();await run();return;
    }
    const dur=Number(s.item.duration_ms||armedTrack?.duration||0),left=dur-Number(s.progress_ms||0);
    if(s.is_playing&&dur>0&&left<=2200)await run();
  }finally{polling=false}},220);
})();

// Automatic DJ breaks: app.js calls this just after Spotify has moved to a new track.
// Capture that exact current URI, mute/pause it, rewind it, speak, then restart the SAME URI at 0:00.
(()=>{
  const wait=ms=>new Promise(r=>setTimeout(r,ms)),player=()=>window.jfmSpotifyPlayer||null;
  async function mute(){try{await player()?.setVolume(0)}catch{}}
  async function volume(){try{await player()?.setVolume(1)}catch{}}
  async function currentUri(){try{const s=await player()?.getCurrentState();return s?.track_window?.current_track?.uri||''}catch{}try{return (await api('/me/player'))?.item?.uri||''}catch{return''}}
  async function stopAtStart(){await mute();for(let i=0;i<5;i++){try{await player()?.pause();await player()?.seek(0)}catch{}try{await api('/me/player/pause',{method:'PUT'});await api('/me/player/seek?position_ms=0',{method:'PUT'})}catch{}await wait(90);try{const s=await player()?.getCurrentState();if(s?.paused)return true}catch{}}return false}
  async function exactStart(uri){if(!uri){await volume();return false}const id=localStorage.getItem('jfm_spotify_device_id')||'';for(let i=0;i<4;i++){try{await api('/me/player/play'+(id?'?device_id='+encodeURIComponent(id):''),{method:'PUT',body:{uris:[uri],position_ms:0}})}catch{}await wait(170+i*80);try{const s=await player()?.getCurrentState();if(s?.track_window?.current_track?.uri===uri){if(s.paused)await player().resume();await player().seek(0).catch(()=>{});await volume();return true}}catch{}}await volume();return false}
  window.djBreak=djBreak=async function(track=null,manual=false){if(djBusy)return;djBusy=true;let uri='';try{uri=await currentUri();await stopAtStart();const target=track||(playback?.item?trackObj(playback.item):null);const[fact,weather]=await Promise.all([getFact(target),getWeather()]);const text=await makeDJScript(target,fact,weather,manual);const el=document.getElementById('djText');if(el)el.textContent=text;document.getElementById('factSource')?.classList.add('hidden');if(document.getElementById('jingles')?.checked&&Math.random()<.18&&!manual){try{await speakText('Josh FM.',true)}catch{}}await speakText(text,false);await wait(80);await exactStart(uri)}catch(e){console.warn('Automatische DJ-break',e);try{await exactStart(uri)}catch{}finally{await volume()}}finally{djBusy=false}};
})();