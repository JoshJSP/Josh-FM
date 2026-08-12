// Josh FM release identity. Version must stay in sync with package.json.
window.JFM_RELEASE={version:'2.1.0',build:'unknown'};
(()=>{
  const render=()=>{
    const version=document.getElementById('appVersion'),build=document.getElementById('appBuild');
    if(version)version.textContent='Josh FM · v'+window.JFM_RELEASE.version;
    if(build)build.textContent='Build '+window.JFM_RELEASE.build;
  };
  async function resolveBuild(){
    render();
    try{
      const r=await fetch('/api/version',{cache:'no-store',headers:{accept:'application/json'}});
      if(!r.ok)return;
      const data=await r.json();
      if(data?.version)window.JFM_RELEASE.version=String(data.version);
      if(data?.commit)window.JFM_RELEASE.build=String(data.commit).slice(0,8);
      render();
    }catch{}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',resolveBuild,{once:true});else resolveBuild();
})();
