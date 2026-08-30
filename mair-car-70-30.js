// MAIRFM Car Mode — keep the agreed 70/30 music/navigation layout near manoeuvres.
(()=>{
'use strict';
if(window.__mairCar7030Fix)return;
window.__mairCar7030Fix=true;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function artwork(){const img=document.getElementById('artImg');return String(img?.currentSrc||img?.src||'mair-icon-512.png')}
function playback(){const p=window.JFMPlaybackState?.get?.()||{};return{title:String(document.getElementById('title')?.textContent||p.title||p.name||'MAIRFM').trim(),artist:String(document.getElementById('artist')?.textContent||p.artist||'').trim(),isPlaying:typeof p.isPlaying==='boolean'?p.isPlaying:!!p.expectedLive}}
function upcoming(){try{return(window.jfmUpcoming?.()||[])[0]||null}catch{return null}}
function keepSplit(){
  const overlay=document.getElementById('mairCarWaveOverlay'),focus=overlay?.querySelector('.car-turn-focus');
  if(!focus||focus.dataset.splitFixed==='1')return;
  const p=playback(),n=upcoming();
  const arrow=focus.querySelector('.car-turn-arrow')?.textContent?.trim()||'↑';
  const distance=focus.querySelector('.car-turn-hero b')?.textContent?.trim()||'—';
  const instruction=focus.querySelector('.car-turn-hero h1')?.textContent?.trim()||window.MAIRJourneyContext?.nextManeuver||'Route volgen';
  const meta=focus.querySelector('.car-turn-hero span')?.textContent?.trim()||'';
  const nextName=n?.name||n?.title||'Wordt bepaald';
  const nextArtist=Array.isArray(n?.artists)?n.artists.map(a=>a?.name||a).join(', '):(n?.artist||'');
  focus.dataset.splitFixed='1';
  focus.classList.add('car-turn-split');
  focus.innerHTML=`<header class="car-drive-head"><strong>MAIRFM <span>· JOURNEY</span></strong><button class="car-more" data-act="menu">•••</button></header><div class="car-turn-split-grid"><section class="car-turn-music"><img class="car-artwork" src="${esc(artwork())}" alt=""><div class="car-track-copy"><small>NU SPEELT</small><h1>${esc(p.title)}</h1><p>${esc(p.artist)}</p><div class="car-controls"><button data-like>♡</button><button data-tr="prev">‹</button><button class="car-play" data-tr="play">${p.isPlaying?'Ⅱ':'▶'}</button><button data-tr="next">›</button></div><div class="car-next"><small>VOLGENDE</small><b>${esc(nextName)}</b><span>${esc(nextArtist)}</span></div></div></section><aside class="car-nav-card car-nav-card-urgent"><div class="car-nav-top"><span>NU</span><span>${esc(meta)}</span></div><div class="car-nav-maneuver"><div class="car-nav-arrow">${esc(arrow)}</div><div><b>${esc(distance)}</b><strong>${esc(instruction)}</strong></div></div></aside></div>`;
}
function boot(){const overlay=document.getElementById('mairCarWaveOverlay');if(!overlay){setTimeout(boot,100);return}new MutationObserver(()=>queueMicrotask(keepSplit)).observe(overlay,{childList:true,subtree:true});keepSplit()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();