// DJ NU: prepare while the current song plays, interrupt just BEFORE the natural transition,
// let the DJ speak in silence, then explicitly start the next song. DJ never talks over music.
(()=>{
  const btn=document.getElementById('djNow');if(!btn)return;
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  let armedId='',armedTrack=null,nextUri='',prepared=null,prepToken=0,running=false,polling=false;
  function setArmed(on){btn.dataset.queued=on?'1':'0';const b=btn.querySelector('b'),s=btn.querySelector('span');if(b)b.textContent=on?'🎙️ DJ staat klaar':'🎙️ DJ nu';if(s)s.textContent=on?'Praat na dit nummer':'Laat hem iets vertellen'}
  async function live(){try{return await api('/me/player')}catch{return null}}
  function findNextUri(id){try{const q=Array.isArray(queue)?queue:[];const i=q.findIndex(t=>t.id===id);if(i>=0&&q[i+1]?.uri)return q[i+1].uri;const n=window.jfmUpcoming?.()?.[0];return n?.uri||''}catch{return''}}
  async function prepare(){const t=armedTrack;if(!t)return;const token=++prepToken;try{const[fact,weather]=await Promise.all([getFact(t),getWeather()]);const text=await makeDJScript(t,fact,weather,true);if(token!==prepToken||armedId!==t.id)return;prepared={text,fact,weather};try{await window.prepareSpeech?.(text,false)}catch{}}catch(e){console.warn('DJ voorbereiding',e)}}
  btn.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();if(running||djBusy||!playback?.item?.id)return;if(armedId===playback.item.id){armedId='';armedTrack=null;nextUri='';prepared=null;prepToken++;setArmed(false);return}armedId=playback.item.id;armedTrack=trackObj(playback.item);nextUri=findNextUri(armedId);prepared=null;setArmed(true);prepare()},true);

  async function pauseNow(){try{const p=window.jfmSpotifyPlayer;if(p){await p.pause();return true}}catch{}try{await api('/me/player/pause',{method:'PUT'});return true}catch{return false}}
  async function playExact(uri){try{const p=window.jfmSpotifyPlayer;if(p&&uri){const id=localStorage.getItem('jfm_spotify_device_id')||'';if(id){try{await api('/me/player/play?device_id='+encodeURIComponent(id),{method:'PUT',body:{uris:[uri]}});await wait(180);const s=await p.getCurrentState();if(s?.paused)await p.resume();return true}catch{}}}}catch{}try{await api('/me/player/play',{method:'PUT',body:uri?{uris:[uri]}:undefined});return true}catch{return false}}

  async function run(){
    if(running||!armedId||!armedTrack)return;
    running=true;djBusy=true;
    const ended=armedTrack,uri=nextUri||findNextUri(armedId);
    armedId='';armedTrack=null;nextUri='';setArmed(false);
    try{
      // Stop BEFORE Spotify can naturally advance. This intentionally clips only the final fraction
      // of a second instead of ever letting the next song play under the DJ.
      await pauseNow();
      let pack=prepared;prepared=null;
      if(!pack){const[fact,weather]=await Promise.all([getFact(ended),getWeather()]);pack={text:await makeDJScript(ended,fact,weather,true),fact,weather}}
      const text=pack.text||'';const d=document.getElementById('djText');if(d)d.textContent=text;document.getElementById('factSource')?.classList.add('hidden');
      await speakText(text,false);
      await wait(80);
      const ok=await playExact(uri);
      const q=document.getElementById('queueInfo');if(q)q.textContent=ok?'DJ klaar · volgend nummer start nu.':'DJ klaar · tik op Play om verder te gaan.';
      try{scheduleTalk()}catch{};setTimeout(()=>refresh().catch(()=>{}),300)
    }catch(e){console.warn('DJ NU',e);try{await playExact(uri)}catch{}}finally{djBusy=false;running=false}
  }

  // Spotify Web API progress is not frame-accurate on iPhone. Trigger with enough margin that
  // the pause command arrives before Spotify's own transition. 1.8 s is intentionally conservative.
  setInterval(async()=>{if(polling||running||!armedId)return;polling=true;try{const s=await live();if(!s?.item)return;playback=s;try{renderPlayback(s)}catch{};
    if(s.item.id!==armedId){
      // We missed the boundary: immediately pause the new track, rewind it, then perform the break.
      try{await pauseNow();const p=window.jfmSpotifyPlayer;if(p)await p.seek(0);else await api('/me/player/seek?position_ms=0',{method:'PUT'})}catch{}
      // Preserve the actually-started track as the post-DJ target.
      nextUri=s.item.uri||nextUri;
      await run();return;
    }
    const dur=Number(s.item.duration_ms||armedTrack?.duration||0),left=dur-Number(s.progress_ms||0);
    if(s.is_playing&&dur>0&&left<=1800)await run();
  }finally{polling=false}},250);
})();

// Automatic DJ breaks happen when app.js notices a track change. Immediately silence and rewind
// that newly-started song before any speech, then resume it from 0:00 after the DJ.
(()=>{
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  async function pauseAndRewind(){try{const p=window.jfmSpotifyPlayer;if(p){await p.pause();await p.seek(0);return true}}catch{}try{await api('/me/player/pause',{method:'PUT'});await api('/me/player/seek?position_ms=0',{method:'PUT'});return true}catch{return false}}
  async function resumeFromStart(){try{const p=window.jfmSpotifyPlayer;if(p){await p.seek(0);await p.resume();return true}}catch{}try{await api('/me/player/seek?position_ms=0',{method:'PUT'});await api('/me/player/play',{method:'PUT'});return true}catch{return false}}
  window.djBreak=djBreak=async function(track=null,manual=false){if(djBusy)return;djBusy=true;try{await pauseAndRewind();const target=track||(playback?.item?trackObj(playback.item):null);const[fact,weather]=await Promise.all([getFact(target),getWeather()]);const text=await makeDJScript(target,fact,weather,manual);const el=document.getElementById('djText');if(el)el.textContent=text;document.getElementById('factSource')?.classList.add('hidden');if(document.getElementById('jingles')?.checked&&Math.random()<.18&&!manual){try{await speakText('Josh FM.',true)}catch{}}await speakText(text,false);await wait(60);await resumeFromStart()}catch(e){console.warn('Automatische DJ-break',e);try{await resumeFromStart()}catch{}}finally{djBusy=false}};
})();