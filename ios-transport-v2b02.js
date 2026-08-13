// Josh FM v2b.0.2 — iOS transport fallback using Spotify Web API only.
(()=>{
  if(window.JFMIOSV2B02)return;
  const isiOS=()=>/iP(hone|ad|od)/i.test(navigator.userAgent||'')||(/Macintosh/i.test(navigator.userAgent||'')&&navigator.maxTouchPoints>1);
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  let busy=false;
  async function remote(){try{return await window.api('/me/player')}catch{return null}}
  async function confirm(wantPlaying){for(let i=0;i<8;i++){await wait(120+i*45);const s=await remote();if(s&&!!s.is_playing===wantPlaying){try{window.JFMPlaybackState?.ingest?.(s,'ios-v2b02')}catch{};try{playback=s;renderPlayback(s)}catch{};return true}}return false}
  async function toggle(){if(busy)return false;busy=true;try{const s=await remote();if(!s?.item)return window.JFMPlayback?.start?.()??false;const want=!s.is_playing;await window.api(want?'/me/player/play':'/me/player/pause',{method:'PUT'});const ok=await confirm(want);const q=document.getElementById('queueInfo');if(q){q.style.color=ok?'':'#ffb4b4';q.textContent=ok?(want?'Josh FM speelt.':'Josh FM staat gepauzeerd.'):'Spotify bevestigde de opdracht niet.'}return ok}catch(e){const q=document.getElementById('queueInfo');if(q){q.style.color='#ffb4b4';q.textContent='Play/pauze mislukt: '+String(e?.message||e)}return false}finally{busy=false}}
  document.addEventListener('click',e=>{const b=e.target?.closest?.('#play');if(!b||!isiOS())return;e.preventDefault();e.stopImmediatePropagation();try{window.jfmSpotifyPlayer?.activateElement?.()}catch{};toggle().catch(()=>{})},true);
  window.JFMIOSV2B02={version:'v2b.0.2-webapi-transport',toggle,get busy(){return busy}};
})();
