// MAIR release metadata and cache/build reconciliation.
window.JFM_RELEASE={version:'2.0.0-beta.8',displayVersion:'2b.0.8',build:'unknown',asset:'80',localCache:'unknown',serverCache:'unknown',updateAvailable:false};
window.JFM_ASSET_VERSION='80';
(()=>{
  function addStyle(id,src){if(document.getElementById(id))return;const l=document.createElement('link');l.id=id;l.rel='stylesheet';l.href=src;document.head.appendChild(l)}
  function ensureAppleIcon(){let l=document.querySelector('link[rel="apple-touch-icon"]');if(!l){l=document.createElement('link');l.rel='apple-touch-icon';document.head.appendChild(l)}l.href='./apple-touch-icon.png';l.sizes='180x180'}
  function scriptLoaded(src){const wanted=new URL(src,location.href).pathname;return[...document.scripts].some(s=>{try{return new URL(s.src,location.href).pathname===wanted}catch{return false}})}
  function addSyncScript(id,src){if(document.getElementById(id)||scriptLoaded(src))return;const s=document.createElement('script');s.id=id;s.src=src;s.async=false;document.head.appendChild(s)}
  function loadMairUI(){
    ensureAppleIcon();
    setTimeout(ensureAppleIcon,3000);
    addStyle('mair-foundation-css','./mair-foundation.css');
    addStyle('mair-radio-home-css','./mair-radio-home.css');
    addStyle('mair-station-art-css','./mair-station-art.css?v=78');
    addStyle('mair-request-layer-fix-css','./request-layer-fix.css?v=78');
    addStyle('mair-personalization-css','./mair-ux-v1.css?v=80');
    addStyle('mair-modes-css','./mair-modes.css?v=80');
    addSyncScript('mair-radio-sequencer-js','./mair-radio-sequencer.js');
    addSyncScript('mair-dj-profile-polish-js','./mair-dj-profile-polish.js');
    addSyncScript('mair-dj-memory-js','./mair-dj-memory.js');
    addSyncScript('mair-dj-transition-fallback-js','./mair-dj-transition-fallback.js');
    addSyncScript('mair-dj-break-owed-guard-js','./mair-dj-break-owed-guard.js');
    addSyncScript('mair-imaging-js','./mair-imaging.js');
    addSyncScript('mair-live-news-js','./mair-live-news.js');
    addSyncScript('mair-news-bulletin-js','./mair-news-bulletin.js');
    addSyncScript('mair-reload-audibility-js','./mair-reload-audibility.js');
    addSyncScript('mair-voice-lab-js','./mair-voice-lab.js');
    addSyncScript('mair-soak-monitor-js','./mair-soak-monitor.js');
    addSyncScript('mair-station-director-js','./mair-station-director.js');
    addSyncScript('mair-sleep-js','./mair-sleep.js')
    addSyncScript('mair-modes-js','./mair-modes.js?v=80')
    addSyncScript('mair-modes-ui-js','./mair-modes-ui.js?v=80')
    addSyncScript('mair-my-mair-js','./mair-my-mair.js?v=80')
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
  window.addEventListener('pageshow',()=>setTimeout(ensureAppleIcon,100));
  loadBuild1Health();setTimeout(loadPersonalLearning,1500);setTimeout(loadProductModel,1700);setTimeout(loadProductUX,2000);setTimeout(loadDataPortability,2300);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',resolveBuild,{once:true});else resolveBuild();
})();
