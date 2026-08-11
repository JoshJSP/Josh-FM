// Josh FM runtime modes — Car Mode, Data Saver, Battery Friendly and Night Interface.
(()=>{
  const $=id=>document.getElementById(id);
  const KEYS={car:'jfm_car_mode',data:'jfm_data_saver',battery:'jfm_battery_mode',night:'jfm_night_mode',nightAuto:'jfm_night_auto'};
  const state={
    car:localStorage.getItem(KEYS.car)==='1',
    data:localStorage.getItem(KEYS.data)==='1',
    battery:localStorage.getItem(KEYS.battery)==='1',
    night:localStorage.getItem(KEYS.night)==='1',
    nightAuto:localStorage.getItem(KEYS.nightAuto)!=='0'
  };
  let lastRender=0;
  function save(k,v){state[k]=!!v;localStorage.setItem(KEYS[k],v?'1':'0');apply()}
  function effectiveNight(){const h=new Date().getHours();return state.night||(state.nightAuto&&(h>=22||h<7))}
  function apply(){
    document.body.classList.toggle('jfm-car-mode',state.car);
    document.body.classList.toggle('jfm-data-saver',state.data);
    document.body.classList.toggle('jfm-battery-mode',state.battery);
    document.body.classList.toggle('jfm-night-mode',effectiveNight());
    document.documentElement.dataset.dataSaver=state.data?'1':'0';
    document.documentElement.dataset.batteryMode=state.battery?'1':'0';
    if(state.data)document.querySelectorAll('img').forEach(img=>{if(img.id!=='artImg')img.loading='lazy';img.decoding='async'});
    renderSettings();renderCar();
    window.dispatchEvent(new CustomEvent('jfm:runtime-mode',{detail:{...state,nightEffective:effectiveNight()}}));
  }
  function current(){
    try{const t=playback?.item?trackObj(playback.item):null;if(t)return t}catch{}
    try{const s=window.JFMPlaybackState?.get?.(),q=Array.isArray(queue)?queue:[];return q.find(t=>t.id===s?.trackId)||null}catch{return null}
  }
  function ensureSettings(){
    if($('jfmRuntimeModes'))return;const pane=$('tab-settings');if(!pane)return;
    const card=document.createElement('article');card.className='card';card.id='jfmRuntimeModes';
    card.innerHTML='<div class="kicker">APP MODI</div><h3>Webapp gedrag</h3><label class="switch"><input id="jfmCarToggle" type="checkbox"><span></span><b>Web Car Mode</b></label><label class="switch"><input id="jfmDataToggle" type="checkbox"><span></span><b>Data Saver</b></label><label class="switch"><input id="jfmBatteryToggle" type="checkbox"><span></span><b>Battery Friendly Mode</b></label><label class="switch"><input id="jfmNightToggle" type="checkbox"><span></span><b>Night Interface nu</b></label><label class="switch"><input id="jfmNightAutoToggle" type="checkbox"><span></span><b>Night Interface automatisch 22:00–07:00</b></label><p class="muted">Playback en herstel blijven prioriteit houden; deze modi besparen vooral UI-, netwerk- en achtergrondwerk.</p>';
    const app=$('installHint')?.closest('.card');if(app)pane.insertBefore(card,app);else pane.appendChild(card);
    $('jfmCarToggle')?.addEventListener('change',e=>save('car',e.target.checked));
    $('jfmDataToggle')?.addEventListener('change',e=>save('data',e.target.checked));
    $('jfmBatteryToggle')?.addEventListener('change',e=>save('battery',e.target.checked));
    $('jfmNightToggle')?.addEventListener('change',e=>save('night',e.target.checked));
    $('jfmNightAutoToggle')?.addEventListener('change',e=>save('nightAuto',e.target.checked));
  }
  function renderSettings(){
    [['jfmCarToggle','car'],['jfmDataToggle','data'],['jfmBatteryToggle','battery'],['jfmNightToggle','night'],['jfmNightAutoToggle','nightAuto']].forEach(([id,k])=>{const e=$(id);if(e)e.checked=!!state[k]})
  }
  function ensureCar(){
    if($('jfmCarView'))return;const el=document.createElement('section');el.id='jfmCarView';el.className='jfm-car-view';
    el.innerHTML='<div class="jfm-car-top"><div><span class="jfm-car-live">LIVE</span><b id="jfmCarShow">Josh FM</b></div><button id="jfmCarExit" type="button">Sluit Car Mode</button></div><div class="jfm-car-art"><img id="jfmCarArt" alt="Albumhoes"><div id="jfmCarArtFallback">JFM</div></div><h2 id="jfmCarTitle">Josh FM</h2><p id="jfmCarArtist">—</p><div class="jfm-car-controls"><button id="jfmCarPrev" type="button" aria-label="Vorige">‹</button><button id="jfmCarPlay" type="button" aria-label="Play of pauze">▶</button><button id="jfmCarNext" type="button" aria-label="Volgende">›</button></div><button id="jfmCarSkipDJ" class="jfm-car-secondary" type="button">🔕 Volgende DJ-break overslaan</button><p id="jfmCarStatus" class="muted">Bedien alleen wanneer dat veilig kan.</p>';
    document.body.appendChild(el);
    $('jfmCarExit')?.addEventListener('click',()=>save('car',false));
    $('jfmCarPlay')?.addEventListener('click',()=>window.JFMPlayback?.playPause?.());
    $('jfmCarNext')?.addEventListener('click',()=>window.JFMPlayback?.next?.());
    $('jfmCarPrev')?.addEventListener('click',()=>window.JFMPlayback?.previous?.());
    $('jfmCarSkipDJ')?.addEventListener('click',()=>document.getElementById('skipTalk')?.click());
  }
  function renderCar(){
    if(!state.car)return;const t=current(),s=window.JFMPlaybackState?.get?.(),show=window.JFMStationClock?.current?.()?.show?.name||'Josh FM';
    if($('jfmCarShow'))$('jfmCarShow').textContent=show;if($('jfmCarTitle'))$('jfmCarTitle').textContent=t?.name||'Josh FM';if($('jfmCarArtist'))$('jfmCarArtist').textContent=(t?.artists||[]).join(', ')||'—';
    const img=$('jfmCarArt'),fb=$('jfmCarArtFallback');if(img&&fb){if(t?.image&&!state.data){img.src=t.image;img.classList.remove('hidden');fb.classList.add('hidden')}else{img.removeAttribute('src');img.classList.add('hidden');fb.classList.remove('hidden')}}
    if($('jfmCarPlay'))$('jfmCarPlay').textContent=s?.isPlaying?'Ⅱ':'▶';
    if($('jfmCarStatus'))$('jfmCarStatus').textContent=!navigator.onLine?'Offline · wacht op verbinding':window.JFMDJTransition?.busy?'DJ live':'Josh FM live';
  }
  function shouldRunNonCritical(){if(state.battery&&document.visibilityState!=='visible')return false;return true}
  function dataBudget(){return state.data?{artwork:false,prefetch:false,discoveryRefreshMs:45*60*1000}:{artwork:true,prefetch:true,discoveryRefreshMs:15*60*1000}}
  function batteryBudget(){return state.battery?{uiIntervalMs:12000,background:false,animations:false}:{uiIntervalMs:4000,background:true,animations:true}}
  function install(){ensureSettings();ensureCar();apply();}
  window.addEventListener('jfm:trackchange',renderCar);window.addEventListener('jfm:playback-state',renderCar);window.addEventListener('jfm:show-change',renderCar);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')renderCar()});
  setInterval(()=>{if(!shouldRunNonCritical())return;const n=Date.now();if(n-lastRender<(state.battery?12000:4000))return;lastRender=n;apply()},4000);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
  window.JFMRuntimeModes={version:'runtime-modes-v1',state:()=>({...state,nightEffective:effectiveNight()}),set:save,apply,shouldRunNonCritical,dataBudget,batteryBudget};
})();
