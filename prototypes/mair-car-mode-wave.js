// MAIRFM Car Mode — Wave Mode presentation prototype.
// Dormant by design: not referenced by index.html and does not own playback.
(()=>{
'use strict';
if(window.MAIRCarModePrototype)return;

const $=id=>document.getElementById(id);
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let overlay=null;
let isOpen=false;
let queuePreview=[];
let djBreakText='—';
let mixLabel='MAIR Mix';

function playbackState(){
  try{return window.JFMPlaybackState?.get?.()||{}}catch{return{}}
}

function currentTrack(){
  const s=playbackState();
  return {
    title:String($('title')?.textContent||s.title||s.name||'MAIRFM').trim(),
    artist:String($('artist')?.textContent||s.artist||'').trim(),
    isPlaying:typeof s.isPlaying==='boolean'?s.isPlaying:!!s.expectedLive,
    trackId:String(s.trackId||''),
    uri:String(s.uri||'')
  };
}

function currentArtwork(){
  const candidates=[
    document.querySelector('#cover img'),
    document.querySelector('#artwork img'),
    document.querySelector('.now-playing img'),
    document.querySelector('[data-now-playing-artwork]'),
    $('cover'),
    $('artwork')
  ].filter(Boolean);
  for(const node of candidates){
    const src=String(node.currentSrc||node.src||'').trim();
    if(src)return src;
  }
  return 'mair-icon-512.png';
}

function waveMarkup(){
  return `<svg viewBox="0 0 900 260" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="mairCarWaveGradient" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#5930a9" stop-opacity=".1"/>
        <stop offset=".48" stop-color="#b865ff"/>
        <stop offset="1" stop-color="#53269a" stop-opacity=".08"/>
      </linearGradient>
    </defs>
    <path d="M-20 145 C75 118 105 185 185 147 S310 65 394 136 S506 202 596 137 S725 82 920 148"/>
    <path d="M-20 159 C94 210 137 84 230 151 S351 205 438 144 S563 75 650 143 S795 207 920 119"/>
    <path d="M-20 119 C83 64 138 201 242 130 S367 78 458 146 S573 201 672 128 S806 73 920 151"/>
  </svg>`;
}

function ensure(){
  if(overlay)return overlay;
  overlay=document.createElement('div');
  overlay.id='mairCarWaveOverlay';
  overlay.className='mair-car-wave-overlay';
  overlay.setAttribute('role','dialog');
  overlay.setAttribute('aria-modal','true');
  overlay.setAttribute('aria-label','MAIRFM Car Mode');
  overlay.innerHTML=`
    <div class="mair-car-shell">
      <aside class="mair-car-rail" aria-label="Car Mode snelkoppelingen">
        <div class="mair-car-brand"><strong>MAIR<span>FM</span></strong><small>CAR MODE</small></div>
        <button type="button" class="mair-car-rail-btn is-live" data-car-action="live"><span class="icon">≋</span><small>LIVE</small></button>
        <button type="button" class="mair-car-rail-btn" data-car-action="favorites"><span class="icon">☆</span><small>FAVORIET</small></button>
        <button type="button" class="mair-car-rail-btn" data-car-action="recent"><span class="icon">◷</span><small>RECENT</small></button>
        <button type="button" class="mair-car-rail-btn" data-car-action="mixer"><span class="icon">☷</span><small>MIXER</small></button>
        <button type="button" class="mair-car-rail-btn mair-car-close" data-car-close aria-label="Car Mode sluiten"><span class="icon">×</span><small>SLUIT</small></button>
      </aside>

      <main class="mair-car-main">
        <div class="mair-car-wave-art">${waveMarkup()}</div>
        <div class="mair-car-topline"><span class="mair-car-onair">ON AIR</span><span id="mairCarClock">--:--</span></div>
        <section class="mair-car-track">
          <span class="station">MAIRFM</span>
          <h1 id="mairCarTitle">MAIRFM</h1>
          <div class="artist" id="mairCarArtist"></div>
          <div class="mair-car-dj"><b>DJ BREAK OVER</b><span id="mairCarDjBreak">—</span></div>
          <div class="mair-car-transport" aria-label="Afspeelbediening">
            <button type="button" class="mair-car-skip" data-car-transport="prev" aria-label="Vorige">◀︎</button>
            <button type="button" class="mair-car-play" data-car-transport="play" aria-label="Play of pauze"><span id="mairCarPlayIcon">Ⅱ</span></button>
            <button type="button" class="mair-car-skip" data-car-transport="next" aria-label="Volgende">▶︎</button>
          </div>
        </section>
        <div class="mair-car-bottom">
          <label class="mair-car-volume"><span>🔊</span><input id="mairCarVolume" type="range" min="0" max="100" value="55" aria-label="Volume"><output id="mairCarVolumeValue">55</output></label>
          <button type="button" class="mair-car-mix mair-car-quick" data-car-action="mixer"><small>MIX</small><b id="mairCarMix">MAIR Mix</b></button>
        </div>
      </main>

      <aside class="mair-car-queue" aria-label="Wat speelt er">
        <div class="mair-car-artrow">
          <img id="mairCarArtwork" class="mair-car-art" src="mair-icon-512.png" alt="Huidige track artwork">
          <button type="button" class="mair-car-fav" data-car-action="favorite-current" aria-label="Huidig nummer favoriet maken">♥</button>
        </div>
        <div id="mairCarQueueList" class="mair-car-queue-list"></div>
      </aside>
    </div>`;
  document.body.appendChild(overlay);

  overlay.addEventListener('click',e=>{
    const close=e.target.closest('[data-car-close]');
    if(close){setOpen(false);return}
    const transport=e.target.closest('[data-car-transport]');
    if(transport){forwardTransport(transport.dataset.carTransport);return}
    const action=e.target.closest('[data-car-action]');
    if(action)emitAction(action.dataset.carAction);
  });

  const volume=$('mairCarVolume');
  volume?.addEventListener('input',()=>{
    const n=Math.max(0,Math.min(100,Number(volume.value)||0));
    const out=$('mairCarVolumeValue');if(out)out.value=String(n);
  });
  volume?.addEventListener('change',()=>setVolume(Number(volume.value)||0));

  return overlay;
}

function forwardTransport(action){
  // Re-use existing MAIRFM controls so this prototype never becomes a second playback owner.
  const targetId=action==='play'?'play':action==='prev'?'prev':action==='next'?'next':'';
  const target=targetId?$(targetId):null;
  if(target){target.click();setTimeout(render,100);return true}
  if(action==='play'&&typeof window.JFMPlayback?.playPause==='function'){
    Promise.resolve(window.JFMPlayback.playPause()).finally(()=>setTimeout(render,100));
    return true;
  }
  emitAction(`transport:${action}`);
  return false;
}

async function setVolume(percent){
  const value=Math.max(0,Math.min(100,Number(percent)||0));
  try{
    if(window.jfmSpotifyPlayer?.setVolume){
      await window.jfmSpotifyPlayer.setVolume(value/100);
      return true;
    }
  }catch{}
  emitAction('volume',{value});
  return false;
}

function emitAction(action,extra={}){
  try{window.dispatchEvent(new CustomEvent('mair:car-action',{detail:{action,...extra}}))}catch{}
}

function queueItems(track){
  const fallback=[
    {label:'NU SPEELT',title:track.title,artist:track.artist},
    {label:'VOLGENDE',title:'Wordt bepaald door MAIR',artist:'Koppel morgen aan de live queue'},
    {label:'DAARNA',title:'—',artist:''}
  ];
  if(!queuePreview.length)return fallback;
  const items=[{label:'NU SPEELT',title:track.title,artist:track.artist}];
  queuePreview.slice(0,2).forEach((item,i)=>items.push({label:i===0?'VOLGENDE':'DAARNA',title:item.title||item.name||'—',artist:item.artist||''}));
  while(items.length<3)items.push({label:items.length===1?'VOLGENDE':'DAARNA',title:'—',artist:''});
  return items;
}

function renderQueue(track){
  const list=$('mairCarQueueList');if(!list)return;
  list.innerHTML=queueItems(track).map(item=>`<div class="mair-car-qitem"><small>${safe(item.label)}</small><b>${safe(item.title)}</b><span>${safe(item.artist)}</span></div>`).join('');
}

function render(){
  ensure();
  const t=currentTrack();
  const title=$('mairCarTitle'),artist=$('mairCarArtist'),play=$('mairCarPlayIcon'),art=$('mairCarArtwork'),clock=$('mairCarClock'),dj=$('mairCarDjBreak'),mix=$('mairCarMix');
  if(title)title.textContent=t.title||'MAIRFM';
  if(artist)artist.textContent=t.artist||'';
  if(play)play.textContent=t.isPlaying?'Ⅱ':'▶︎';
  if(art){const src=currentArtwork();if(src&&art.getAttribute('src')!==src)art.setAttribute('src',src)}
  if(clock)clock.textContent=new Date().toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'});
  if(dj)dj.textContent=djBreakText;
  if(mix)mix.textContent=mixLabel;
  renderQueue(t);
}

function setOpen(value){
  ensure();
  isOpen=!!value;
  overlay.classList.toggle('is-open',isOpen);
  document.body.classList.toggle('mair-car-mode-open',isOpen);
  if(isOpen){render();document.body.dataset.mairCarMode='1'}
  else delete document.body.dataset.mairCarMode;
  try{window.dispatchEvent(new CustomEvent('mair:car-mode',{detail:{open:isOpen}}))}catch{}
}

function setQueue(items=[]){
  queuePreview=Array.isArray(items)?items.filter(Boolean).slice(0,2):[];
  if(isOpen)render();
}

function setDJBreak(value){djBreakText=String(value||'—');if(isOpen)render()}
function setMix(value){mixLabel=String(value||'MAIR Mix');if(isOpen)render()}

function onKey(e){if(isOpen&&e.key==='Escape')setOpen(false)}
function onChange(){if(isOpen)render()}
document.addEventListener('keydown',onKey);
['jfm:trackchange','jfm:playback-state','mair:channelchange','mair:foundation-ready'].forEach(name=>window.addEventListener(name,onChange));
setInterval(()=>{if(isOpen)render()},1000);

window.MAIRCarModePrototype={
  version:'wave-layout-2026-08-29',
  open:()=>setOpen(true),
  close:()=>setOpen(false),
  toggle:()=>setOpen(!isOpen),
  render,
  setQueue,
  setDJBreak,
  setMix,
  status:()=>({open:isOpen,queue:queuePreview.slice(),djBreakText,mixLabel})
};
})();
