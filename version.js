// MAIR release metadata and cache/build reconciliation.
window.JFM_RELEASE={version:'2.0.0-beta.6',displayVersion:'2b.0.6',build:'unknown',asset:'58',localCache:'unknown',serverCache:'unknown',updateAvailable:false};
window.JFM_ASSET_VERSION='58';
(()=>{
  function addStyle(id,src){if(document.getElementById(id))return;const l=document.createElement('link');l.id=id;l.rel='stylesheet';l.href=src;document.head.appendChild(l)}
  function addSyncScript(id,src){if(document.getElementById(id))return;const s=document.createElement('script');s.id=id;s.src=src;s.async=false;document.head.appendChild(s)}
  function loadMairUI(){
    addStyle('mair-foundation-css','./mair-foundation.css');
    addStyle('mair-radio-home-css','./mair-radio-home.css');
    addStyle('mair-station-art-css','./mair-station-art.css?v=58');
    addSyncScript('mair-foundation-js','./mair-foundation.js');
    addSyncScript('mair-radio-home-js','./mair-radio-home.js')
  }
  loadMairUI();
  function sanitizeSleepState(){try{const key='jfm_sleep_timer_v1',raw=localStorage.getItem(key);if(!raw)return;const x=JSON.parse(raw),expired=x?.mode==='time'&&Number(x?.at||0)<=Date.now(),unsafe=x?.mode==='after-track';if(expired||unsafe)localStorage.setItem(key,'null')}catch{try{localStorage.setItem('jfm_sleep_timer_v1','null')}catch{}}}
  sanitizeSleepState();
  const render=()=>{const version=document.getElementById('appVersion'),build=document.getElementById('appBuild');if(version)version.textContent='MAIR · v'+(window.JFM_RELEASE.displayVersion||window.JFM_RELEASE.version);if(build)build.textContent='Build '+window.JFM_RELEASE.build};
  function emit(){try{window.dispatchEvent(new CustomEvent('jfm:release-status',{detail:{...window.JFM_RELEASE}}))}catch{}}
  function requestCacheVersion(){try{navigator.serviceWorker?.controller?.postMessage?.({type:'CACHE_VERSION'})}catch{}}
  function loadScript(id,src){if(document.getElementById(id))return;const s=document.createElement('script');s.id=id;s.src=src;s.async=true;document.head.appendChild(s)}
  function loadBuild1Health(){loadScript('jfm-radio-core-health-v1','./radio-core-health-v1.js')}
  function loadMusicIntelligence(){loadScript('jfm-music-intelligence-v3','./music-intelligence-v3.js')}
  function loadPersonalLearning(){loadScript('jfm-personal-learning-v4','./personal-learning-v4.js')}
  function loadProductModel(){loadScript('jfm-product-model-v6','./product-model-v6.js')}
  function loadProductUX(){loadScript('jfm-product-ux-v5','./product-ux-v5.js')}
  function loadDataPortability(){loadScript('jfm-data-portability-v9','./data-portability-v9.js')}
  async function resolveBuild(){render();try{const r=await fetch('/api/version',{cache:'no-store',headers:{accept:'application/json'}});if(r.ok){const data=await r.json();if(data?.version)window.JFM_RELEASE.version=String(data.version);if(data?.displayVersion)window.JFM_RELEASE.displayVersion=String(data.displayVersion);if(data?.commit)window.JFM_RELEASE.build=String(data.commit).slice(0,8);if(data?.cache)window.JFM_RELEASE.serverCache=String(data.cache)}}catch{}render();requestCacheVersion();setTimeout(requestCacheVersion,300);emit()}
  navigator.serviceWorker?.addEventListener?.('message',e=>{if(e.data?.type!=='CACHE_VERSION')return;window.JFM_RELEASE.localCache=String(e.data.cache||'unknown');const server=window.JFM_RELEASE.serverCache,local=window.JFM_RELEASE.localCache;window.JFM_RELEASE.updateAvailable=!!(server&&local&&server!=='unknown'&&local!=='unknown'&&local!==server);emit()});
  window.addEventListener('jfm:diagnostics-refresh',resolveBuild);
  loadBuild1Health();setTimeout(loadMusicIntelligence,1200);setTimeout(loadPersonalLearning,1500);setTimeout(loadProductModel,1700);setTimeout(loadProductUX,2000);setTimeout(loadDataPortability,2300);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',resolveBuild,{once:true});else resolveBuild();
})();
