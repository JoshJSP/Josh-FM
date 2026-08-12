// Josh FM release identity + update awareness. Version must stay in sync with package.json.
window.JFM_RELEASE={version:'2.2.0',build:'unknown',serverCache:'',localCache:'',updateAvailable:false};
(()=>{
  const render=()=>{
    const version=document.getElementById('appVersion'),build=document.getElementById('appBuild');
    if(version)version.textContent='Josh FM · v'+window.JFM_RELEASE.version;
    if(build)build.textContent='Build '+window.JFM_RELEASE.build;
  };
  function askCache(){return new Promise(resolve=>{const ctrl=navigator.serviceWorker?.controller;if(!ctrl)return resolve('');const on=e=>{if(e.data?.type==='CACHE_VERSION'){navigator.serviceWorker.removeEventListener('message',on);resolve(String(e.data.cache||''))}};navigator.serviceWorker.addEventListener('message',on);ctrl.postMessage({type:'CACHE_VERSION'});setTimeout(()=>{navigator.serviceWorker.removeEventListener('message',on);resolve('')},1200)})}
  async function resolveBuild(){
    render();
    try{
      const [r,localCache]=await Promise.all([fetch('/api/version',{cache:'no-store',headers:{accept:'application/json'}}),askCache()]);
      if(!r.ok)return;
      const data=await r.json();
      if(data?.version)window.JFM_RELEASE.version=String(data.version);
      if(data?.commit)window.JFM_RELEASE.build=String(data.commit).slice(0,8);
      window.JFM_RELEASE.serverCache=String(data?.cache||'');window.JFM_RELEASE.localCache=String(localCache||'');
      window.JFM_RELEASE.updateAvailable=!!(window.JFM_RELEASE.serverCache&&window.JFM_RELEASE.localCache&&window.JFM_RELEASE.serverCache!==window.JFM_RELEASE.localCache);
      render();window.dispatchEvent(new CustomEvent('jfm:release-status',{detail:{...window.JFM_RELEASE}}));
    }catch{}
  }
  function loadFeature(src,id){if(document.getElementById(id))return;const s=document.createElement('script');s.id=id;s.src=src+'?v=22';s.async=false;document.body.appendChild(s)}
  function bootFeatures(){loadFeature('./music-choice.js','jfm-music-choice');loadFeature('./release-diagnostics.js','jfm-release-diagnostics')}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{resolveBuild();setTimeout(bootFeatures,0)},{once:true});else{resolveBuild();setTimeout(bootFeatures,0)}
})();
