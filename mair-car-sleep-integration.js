// MAIRFM Car Mode + Sleep Mode integration bridge.
(()=>{
'use strict';
if(window.__mairCarSleepIntegration)return;
window.__mairCarSleepIntegration=true;

const $=id=>document.getElementById(id);
const asset=(tag,attrs)=>new Promise((resolve,reject)=>{
  const marker=attrs.id&&document.getElementById(attrs.id);
  if(marker){resolve(marker);return}
  const el=document.createElement(tag);
  Object.entries(attrs).forEach(([k,v])=>{if(k==='text')el.textContent=v;else el.setAttribute(k,v)});
  el.onload=()=>resolve(el);el.onerror=()=>reject(new Error(`Kon ${attrs.href||attrs.src||tag} niet laden`));
  document.head.appendChild(el);
});
const loadScript=(src,id)=>asset('script',{src,id});
const loadStyle=(href,id)=>asset('link',{rel:'stylesheet',href,id});

function queuePreview(){
  try{
    const now=window.JFMPlaybackState?.get?.()||{};
    const uri=String(now.uri||'');
    const tracks=window.JFMQueue?.current?.()||[];
    const start=Math.max(0,tracks.findIndex(t=>String(t?.uri||'')===uri)+1);
    return tracks.slice(start,start+2).map(t=>({
      title:String(t?.name||t?.title||'—'),
      artist:String(t?.artists?.[0]?.name||t?.artist||'')
    }));
  }catch{return[]}
}

function syncCar(){
  const car=window.MAIRCarModePrototype;if(!car)return;
  try{car.setQueue(queuePreview())}catch{}
  try{
    const mode=String($('modeLabel')?.textContent||$('modeMini')?.textContent||'MAIR Mix').trim();
    car.setMix(mode||'MAIR Mix');
  }catch{}
  try{
    const raw=String($('djBreakTime')?.textContent||'').trim();
    car.setDJBreak(raw&&raw!=='nog niet'?raw:'—');
  }catch{}
}

function ensureLauncher(){
  const radio=$('tab-radio');
  if(!radio||$('mairCarModeOpen'))return;
  const b=document.createElement('button');
  b.id='mairCarModeOpen';
  b.type='button';
  b.className='mair-sleep-launch mair-car-launch';
  b.innerHTML='🚗 Car Mode <span>Groot horizontaal Wave-scherm</span>';
  b.addEventListener('click',()=>{
    syncCar();
    window.MAIRCarModePrototype?.open?.();
    try{screen.orientation?.lock?.('landscape').catch?.(()=>{})}catch{}
  });
  const anchor=$('mairSleepOpen')||$('djNow')?.closest('.grid2');
  if(anchor)anchor.insertAdjacentElement('afterend',b);else radio.appendChild(b);
}

function bindCarActions(){
  window.addEventListener('mair:car-action',e=>{
    const action=e.detail?.action;
    if(action==='favorite-current'){$('loveTrack')?.click();return}
    if(action==='live')return;
    if(action==='recent'){
      window.MAIRCarModePrototype?.close?.();
      document.querySelector('[data-tab="radio"]')?.click();
      return;
    }
    if(action==='mixer'){
      window.MAIRCarModePrototype?.close?.();
      document.querySelector('[data-tab="radio"]')?.click();
      document.querySelector('[data-mode="chill"]')?.scrollIntoView?.({behavior:'smooth',block:'center'});
    }
  });
}

async function boot(){
  try{
    await Promise.all([
      loadStyle('prototypes/mair-car-mode-wave.css','mairCarModeCss'),
      loadStyle('prototypes/mair-sleep-landscape.css','mairSleepLandscapeCss')
    ]);
    await loadScript('mair-sleep.js','mairSleepRuntime');
    await loadScript('prototypes/mair-sleep-landscape.js','mairSleepLandscapeRuntime');
    await loadScript('prototypes/mair-car-mode-wave.js','mairCarModeRuntime');
    ensureLauncher();
    syncCar();
    bindCarActions();
    ['jfm:trackchange','jfm:queue-change','jfm:playback-state','mair:channelchange','mair:sleep'].forEach(name=>window.addEventListener(name,()=>{syncCar();ensureLauncher()}));
    setInterval(()=>{syncCar();ensureLauncher()},2000);
    window.MAIRCarSleepIntegration={
      version:'2026-08-29',
      openCar:()=>{syncCar();window.MAIRCarModePrototype?.open?.()},
      openSleep:()=>window.MAIRSleep?.open?.(),
      status:()=>({car:window.MAIRCarModePrototype?.status?.()||null,sleep:window.MAIRSleep?.status?.()||null,landscape:window.MAIRSleepLandscapePrototype?.status?.()||null})
    };
    window.dispatchEvent(new CustomEvent('mair:car-sleep-ready'));
  }catch(error){
    console.error('[MAIR car/sleep integration]',error);
  }
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})();
