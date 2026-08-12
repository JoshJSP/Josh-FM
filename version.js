// Josh FM release identity. Version must stay in sync with package.json.
window.JFM_RELEASE={version:'2.2.1',build:'unknown',asset:'39',localCache:'unknown',serverCache:'unknown',updateAvailable:false};
window.JFM_ASSET_VERSION='39';
(()=>{
  const render=()=>{
    const version=document.getElementById('appVersion'),build=document.getElementById('appBuild');
    if(version)version.textContent='Josh FM · v'+window.JFM_RELEASE.version;
    if(build)build.textContent='Build '+window.JFM_RELEASE.build;
  };
  function emit(){try{window.dispatchEvent(new CustomEvent('jfm:release-status',{detail:{...window.JFM_RELEASE}}))}catch{}}
  function requestCacheVersion(){try{navigator.serviceWorker?.controller?.postMessage?.({type:'CACHE_VERSION'})}catch{}}
  async function resolveBuild(){
    render();
    try{
      const r=await fetch('/api/version',{cache:'no-store',headers:{accept:'application/json'}});
      if(r.ok){const data=await r.json();if(data?.version)window.JFM_RELEASE.version=String(data.version);if(data?.commit)window.JFM_RELEASE.build=String(data.commit).slice(0,8);if(data?.cache)window.JFM_RELEASE.serverCache=String(data.cache)}
    }catch{}
    render();requestCacheVersion();setTimeout(requestCacheVersion,300);emit();
  }
  navigator.serviceWorker?.addEventListener?.('message',e=>{if(e.data?.type!=='CACHE_VERSION')return;window.JFM_RELEASE.localCache=String(e.data.cache||'unknown');window.JFM_RELEASE.updateAvailable=!!(window.JFM_RELEASE.serverCache&&window.JFM_RELEASE.serverCache!=='unknown'&&window.JFM_RELEASE.localCache!==window.JFM_RELEASE.serverCache);emit()});
  window.addEventListener('jfm:diagnostics-refresh',resolveBuild);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',resolveBuild,{once:true});else resolveBuild();
})();
