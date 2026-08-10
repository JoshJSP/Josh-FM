// DJ NU: prepare while the current song plays, pause Spotify right at the boundary,
// let the DJ speak, then start the next song. DJ never talks over music.
(()=>{
  const btn=document.getElementById('djNow');if(!btn)return;
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  let armedId='',armedTrack=null,prepared=null,prepToken=0,running=false,polling=false;
  function setArmed(on){btn.dataset.queued=on?'1':'0';const b=btn.querySelector('b'),s=btn.querySelector('span');if(b)b.textContent=on?'🎙️ DJ staat klaar':'🎙️ DJ nu';if(s)s.textContent=on?'Praat na dit nummer':'Laat hem iets vertellen'}
  async function live(){try{return await api('/me/player')}catch{return null}}
  async function prepare(){const t=armedTrack;if(!t)return;const token=++prepToken;try{const[fact,weather]=await Promise.all([getFact(t),getWeather()]);const text=await makeDJScript(t,fact,weather,true);if(token!==prepToken||armedId!==t.id)return;prepared={text,fact,weather};try{await window.prepareSpeech?.(text,false)}catch{}}catch(e){console.warn('DJ voorbereiding',e)}}
  btn.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();if(running||djBusy||!playback?.item?.id)return;if(armedId===playback.item.id){armedId='';armedTrack=null;prepared=null;prepToken++;setArmed(false);return}armedId=playback.item.id;armedTrack=trackObj(playback.item);prepared=null;setArmed(true);prepare()},true);
  async function pausePlayer(){try{const p=window.jfmSpotifyPlayer;if(p){await p.pause();return true}}catch{}try{await api('/me/player/pause',{method:'PUT'});return true}catch{return false}}
  async function nextAndPlay(){try{const p=window.jfmSpotifyPlayer;if(p){await p.nextTrack();await wait(120);const s=await p.getCurrentState();if(s?.paused)await p.resume();return true}}catch{}try{await api('/me/player/next',{method:'POST'});await wait(120);await api('/me/player/play',{method:'PUT'});return true}catch{return false}}
  async function restartCurrentAndPlay(){try{const p=window.jfmSpotifyPlayer;if(p){await p.seek(0);await p.resume();return true}}catch{}try{await api('/me/player/seek?position_ms=0',{method:'PUT'});await api('/me/player/play',{method:'PUT'});return true}catch{return false}}
  async function run(afterNaturalAdvance=false){if(running||!armedId||!armedTrack)return;running=true;djBusy=true;const ended=armedTrack;armedId='';armedTrack=null;setArmed(false);try{let pack=prepared;prepared=null;if(!pack){const[fact,weather]=await Promise.all([getFact(ended),getWeather()]);pack={text:await makeDJScript(ended,fact,weather,true),fact,weather}}const text=pack.text||'';const d=document.getElementById('djText');if(d)d.textContent=text;document.getElementById('factSource')?.classList.add('hidden');
      await pausePlayer();
      // If Spotify already advanced before our last poll, rewind the new song so no intro is lost.
      if(afterNaturalAdvance){try{const p=window.jfmSpotifyPlayer;if(p)await p.seek(0);else await api('/me/player/seek?position_ms=0',{method:'PUT'})}catch{}}
      await speakText(text,false);
      let ok=false;if(afterNaturalAdvance)ok=await restartCurrentAndPlay();else ok=await nextAndPlay();
      const q=document.getElementById('queueInfo');if(q)q.textContent=ok?'DJ klaar · volgend nummer speelt.':'DJ klaar · tik op Play om verder te gaan.';try{scheduleTalk()}catch{};setTimeout(()=>refresh().catch(()=>{}),300)
    }catch(e){console.warn('DJ NU',e)}finally{djBusy=false;running=false}}
  setInterval(async()=>{if(polling||running||!armedId)return;polling=true;try{const s=await live();if(!s?.item)return;playback=s;try{renderPlayback(s)}catch{};if(s.item.id!==armedId){await run(true);return}const dur=Number(s.item.duration_ms||armedTrack?.duration||0),left=dur-Number(s.progress_ms||0);if(s.is_playing&&dur>0&&left<=450)await run(false)}finally{polling=false}},300);
})();

// Automatic DJ breaks: pause the newly started song, rewind it to 0:00, speak, then resume.
(()=>{
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  async function pauseAndRewind(){try{const p=window.jfmSpotifyPlayer;if(p){await p.pause();await p.seek(0);return true}}catch{}try{await api('/me/player/pause',{method:'PUT'});await api('/me/player/seek?position_ms=0',{method:'PUT'});return true}catch{return false}}
  async function resumeFromStart(){try{const p=window.jfmSpotifyPlayer;if(p){await p.seek(0);await p.resume();return true}}catch{}try{await api('/me/player/seek?position_ms=0',{method:'PUT'});await api('/me/player/play',{method:'PUT'});return true}catch{return false}}
  window.djBreak=djBreak=async function(track=null,manual=false){if(djBusy)return;djBusy=true;try{const target=track||(playback?.item?trackObj(playback.item):null);const[fact,weather]=await Promise.all([getFact(target),getWeather()]);const text=await makeDJScript(target,fact,weather,manual);const el=document.getElementById('djText');if(el)el.textContent=text;document.getElementById('factSource')?.classList.add('hidden');await pauseAndRewind();if(document.getElementById('jingles')?.checked&&Math.random()<.18&&!manual){try{await speakText('Josh FM.',true)}catch{}}await speakText(text,false);await wait(60);await resumeFromStart()}catch(e){console.warn('Automatische DJ-break',e);try{await resumeFromStart()}catch{}}finally{djBusy=false}};
})();