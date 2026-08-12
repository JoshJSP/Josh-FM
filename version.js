// Josh FM release identity. Keep this in sync with package.json for every production release.
window.JFM_RELEASE = Object.freeze({ version: '2.1.0', build: 'version-ui' });
(()=>{
  const render=()=>{
    const version=document.getElementById('appVersion');
    const build=document.getElementById('appBuild');
    if(version) version.textContent='Josh FM · v'+window.JFM_RELEASE.version;
    if(build) build.textContent='Build '+window.JFM_RELEASE.build;
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',render,{once:true}); else render();
})();
