// Josh FM v2.2.6 runtime bootstrap for DJ, progress and Product Beta modules.
(()=>{
  const load=(src,id)=>new Promise(resolve=>{
    if(document.getElementById(id))return resolve(true);
    const s=document.createElement('script');s.id=id;s.src=src;s.onload=()=>resolve(true);s.onerror=()=>resolve(false);document.body.appendChild(s);
  });
  let ownedRefresh=null;
  async function boot(){
    await load('./brand-config.js','jfm-brand-config-v9');
    await load('./brand-runtime-v9.js','jfm-brand-runtime-v9');
    await load('./progress-clock-v226.js','jfm-progress-v226');
    await load('./dj-authoritative-v226.js','jfm-dj-v226');
    setTimeout(()=>load('./beta-status.js','jfm-beta-status-v8'),2600);
    if(typeof window.refresh==='function')ownedRefresh=window.refresh;
  }
  boot();
  window.addEventListener('pageshow',()=>setTimeout(()=>{if(ownedRefresh){try{refresh=ownedRefresh;window.refresh=ownedRefresh}catch{}}},700));
  setInterval(()=>{if(ownedRefresh&&window.JFMDJAuthoritative){try{refresh=ownedRefresh;window.refresh=ownedRefresh}catch{}}},1500);
  window.JFMV226Bootstrap={version:'v226-dj-progress',get ready(){return !!(window.JFMDJAuthoritative&&window.JFMProgressClock)}};
})();
