// MAIR runtime modes — compatibility runtime for Car Mode only. User-facing controls live in mair-user-controls.js.
(()=>{
  const $=id=>document.getElementById(id);
  const KEY='jfm_car_mode';
  const state={car:localStorage.getItem(KEY)==='1'};
  let lastRender=0;
  function save(k,v){
    if(k!=='car')return false;
    state.car=!!v;localStorage.setItem(KEY,v?'1':'0');apply(true);return true
  }
  function apply(force=false){
    document.body.classList.toggle('jfm-car-mode',state.car);
    document.body.classList.toggle('mair-car-mode',state.car);
    if(force)try{window.dispatchEvent(new CustomEvent('mair:car-mode',{detail:{enabled:state.car}}))}catch{}
    renderCar();return true
  }
  function current(){try{const t=playback?.item?trackObj(playback.item):null;if(t)return t}catch{}try{const s=window.JFMPlaybackState?.get?.(),q=Array.isArray(queue)?queue:[];return q.find(t=>t.id===s?.trackId)||null}catch{return null}}
  function ensureCar(){
    if($('jfmCarView'))return;const el=document.createElement('section');el.id='jfmCarView';el.className='jfm-car-view';el.innerHTML='<div class="jfm-car-top"><div><span class="jfm-car-live">LIVE</span><b id="jfmCarShow">MAIR</b></div><button id="jfmCarExit" type="button">Sluit Car Mode</button></div><div class="jfm-car-art"><img id="jfmCarArt" alt="Albumhoes"><div id="jfmCarArtFallback">MAIR</div></div><h2 id="jfmCarTitle">MAIR</h2><p id="jfmCarArtist">—</p><div class="jfm-car-controls"><button id="jfmCarPrev" type="button" aria-label="Vorige">‹</button><button id="jfmCarPlay" type="button" aria-label="Play of pauze">▶</button><button id="jfmCarNext" type="button" aria-label="Volgende">›</button></div><button id="jfmCarSkipDJ" class="jfm-car-secondary" type="button">🔕 Volgende DJ-break overslaan</button><p id="jfmCarStatus" class="muted">Bedien alleen wanneer dat veilig kan.</p>';document.body.appendChild(el);
    $('jfmCarExit')?.addEventListener('click',()=>save('car',false));$('jfmCarPlay')?.addEventListener('click',()=>window.MAIRPlayback?.playPause?.()||window.JFMPlayback?.playPause?.());$('jfmCarNext')?.addEventListener('click',()=>window.MAIRPlayback?.next?.()||window.JFMPlayback?.next?.());$('jfmCarPrev')?.addEventListener('click',()=>window.MAIRPlayback?.previous?.()||window.JFMPlayback?.previous?.());$('jfmCarSkipDJ')?.addEventListener('click',()=>document.getElementById('skipTalk')?.click());
  }
  function renderCar(){if(!state.car)return;const t=current(),s=window.JFMPlaybackState?.get?.(),show=window.JFMStationClock?.current?.()?.show?.name||'MAIR';if($('jfmCarShow'))$('jfmCarShow').textContent=show;if($('jfmCarTitle'))$('jfmCarTitle').textContent=t?.name||'MAIR';if($('jfmCarArtist'))$('jfmCarArtist').textContent=(t?.artists||[]).join(', ')||'—';const img=$('jfmCarArt'),fb=$('jfmCarArtFallback');if(img&&fb){if(t?.image){img.src=t.image;img.classList.remove('hidden');fb.classList.add('hidden')}else{img.removeAttribute('src');img.classList.add('hidden');fb.classList.remove('hidden')}}if($('jfmCarPlay'))$('jfmCarPlay').textContent=s?.isPlaying?'Ⅱ':'▶';if($('jfmCarStatus'))$('jfmCarStatus').textContent=!navigator.onLine?'Offline · wacht op verbinding':window.JFMDJTransition?.busy?'DJ live':'MAIR live'}
  function install(){ensureCar();apply(true)}
  window.addEventListener('jfm:trackchange',renderCar);window.addEventListener('jfm:playback-state',renderCar);window.addEventListener('jfm:show-change',renderCar);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){apply();renderCar()}});
  setInterval(()=>{if(!state.car)return;const n=Date.now();if(n-lastRender<4000)return;lastRender=n;renderCar()},4000);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
  // Keep the old API surface as a compatibility alias while removing the retired modes.
  window.JFMRuntimeModes={version:'runtime-modes-v3-car-only',state:()=>({car:state.car,data:false,battery:false,night:false,nightAuto:false,nightEffective:false}),set:save,apply,shouldRunNonCritical:()=>true,dataBudget:()=>({artwork:true,prefetch:true,discoveryRefreshMs:15*60*1000,maxDiscoveryPercent:100}),batteryBudget:()=>({uiIntervalMs:4000,background:true,animations:true})};
  window.MAIRCarMode=window.JFMRuntimeModes;
})();
