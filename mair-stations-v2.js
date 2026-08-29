// MAIR Stations v2 — one visual catalog, one identity per station.
(()=>{
'use strict';
if(window.MAIRStationsV2)return;
const $=id=>document.getElementById(id);
const fallback={
  mix:{label:'MY MAIR',tagline:'Your radio. Your way.',desc:'Volledig persoonlijk samengesteld.',cover:'./assets/mair-mix.svg'},
  hits:{label:'MAIR HITS',tagline:"Today's biggest hits",desc:'De grootste actuele radiohits van nu.',cover:'./assets/stations/mair-hits.webp'},
  top40:{label:'MAIR TOP 40',tagline:'The chart. Nothing else.',desc:'De actuele Nederlandse Top 40.',cover:'./assets/stations/mair-top40.webp'},
  new:{label:'MAIR DISCOVERY',tagline:'Find your next favorite',desc:'Nieuwe en minder voor de hand liggende recente tracks.',cover:'./assets/stations/mair-discovery.webp'},
  nl:{label:'MAIR NEDERLANDSTALIG',tagline:'Alles in je moerstaal',desc:'Nederlandstalige tracks, taal eerst.',cover:'./assets/stations/mair-nederlandstalig.webp'},
  party:{label:'MAIR PARTY',tagline:'Energy. Dance. Repeat.',desc:'Energieke tracks met echte feestflow.',cover:'./assets/stations/mair-party.webp'},
  chill:{label:'MAIR CHILL',tagline:'Relax & unwind',desc:'Warme rustige songs om bij te ontspannen.',cover:'./assets/stations/mair-chill.webp'},
  sleep:{label:'MAIR SLEEP',tagline:'Slow down. Stay asleep.',desc:'Zeer rustige echte songs zonder slaapgeluiden.',cover:'./assets/stations/mair-sleep.svg'},
  summer:{label:'MAIR SUMMER',tagline:'Sun out. MAIR on.',desc:'Zonnige feelgood, tropical, latin-pop en dance.',cover:'./assets/stations/mair-summer.webp'},
  throwback:{label:'MAIR THROWBACK',tagline:'The songs you love',desc:'Grote classics uit de 80s, 90s en vroege 00s.',cover:'./assets/stations/mair-throwback.webp'},
  '00s':{label:'MAIR 00s',tagline:'Back to the 00s',desc:'Alleen 2000–2009.',cover:'./assets/stations/mair-00s.webp'},
  '10s':{label:'MAIR 10s',tagline:'The decade that still hits',desc:'Alleen 2010–2019.',cover:'./assets/stations/mair-10s.webp'}
};
const order=['mix','hits','top40','new','nl','party','chill','sleep','summer','throwback','00s','10s'];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function catalog(){const p=window.MAIRStationPolicy;return order.map(id=>{const x=p?.get?.(id)||fallback[id];return{id,label:x.label||fallback[id].label,tagline:x.tagline||fallback[id].tagline,desc:x.desc||fallback[id].desc,cover:x.cover||fallback[id].cover}})}
function syncChoiceMetadata(){const channels=window.JFMMusicChoice?.channels;if(!channels)return;for(const x of catalog()){if(!channels[x.id])continue;channels[x.id].label=x.label;channels[x.id].desc=x.desc;channels[x.id].cover=x.cover;channels[x.id].tagline=x.tagline}}
function render(){syncChoiceMetadata();const pane=$('tab-stations-mair');if(!pane)return false;const active=localStorage.getItem('jfm_music_channel_v1')||'mix';pane.innerHTML=`<div class="mair-page-title"><h2>Stations</h2><p class="mair-stations-intro">Elke MAIR-zender heeft zijn eigen sound, selectie en flow.</p></div><div class="mair-station-grid mair-station-grid-v2">${catalog().map(x=>`<button type="button" class="mair-station-card mair-station-card-v2${x.id===active?' active':''}" data-mair-station="${esc(x.id)}" aria-pressed="${x.id===active?'true':'false'}"><span class="mair-station-cover"><img src="${esc(x.cover)}" alt="${esc(x.label)} cover"></span><span class="mair-station-copy"><b>${esc(x.label)}</b><small>${esc(x.tagline)}</small><em>${esc(x.desc)}</em></span><strong>›</strong></button>`).join('')}</div>`;return true}
function style(){if($('mairStationsV2Style'))return;const s=document.createElement('style');s.id='mairStationsV2Style';s.textContent=`
.mair-stations-intro{margin:7px 0 0;color:#888;font-size:9px;line-height:1.45}.mair-station-grid-v2{display:grid!important;gap:8px!important;background:transparent!important;border:0!important;border-radius:0!important;overflow:visible!important}.mair-station-card-v2{grid-template-columns:72px minmax(0,1fr) 18px!important;min-height:88px!important;padding:8px!important;border:1px solid #1f1f1f!important;border-radius:14px!important;background:#101010!important}.mair-station-card-v2.active{background:#17100c!important;border-color:#4a2817!important;box-shadow:inset 0 0 0 1px rgba(255,106,0,.12)}.mair-station-cover{width:72px;height:72px;border-radius:12px;overflow:hidden;background:#0b0b0b;display:block;box-shadow:0 10px 26px rgba(0,0,0,.25)}.mair-station-cover img{width:100%;height:100%;display:block;object-fit:cover}.mair-station-card-v2 .mair-station-copy b{font-size:12px!important;letter-spacing:-.01em}.mair-station-card-v2 .mair-station-copy small{font-size:9px!important;color:#aaa!important;margin-top:3px!important}.mair-station-card-v2 .mair-station-copy em{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-top:5px;font-style:normal;color:#666;font-size:8px;line-height:1.35}.mair-station-card-v2 strong{color:#666!important;font-size:19px!important}.mair-station-card-v2.active strong{color:#ff6a00!important}
`;document.head.appendChild(s)}
function syncActive(){const active=localStorage.getItem('jfm_music_channel_v1')||'mix';document.querySelectorAll('.mair-station-card-v2').forEach(b=>{const on=b.dataset.mairStation===active;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on?'true':'false')})}
function boot(){style();syncChoiceMetadata();let tries=0;const draw=()=>{if(render())return;if(++tries<30)setTimeout(draw,150)};draw();window.addEventListener('mair:foundation-ready',()=>setTimeout(render,0));window.addEventListener('mair:channelchange',syncActive);window.addEventListener('mair:station-selected',syncActive);window.addEventListener('pageshow',()=>setTimeout(()=>{render();syncActive()},120))}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.MAIRStationsV2={version:'mair-stations-v2.0-cover-catalog',catalog,render,sync:syncActive};
})();