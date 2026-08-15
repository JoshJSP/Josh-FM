// MAIR runtime bootstrap — progress + rebuilt DJ v2 + temporary Voice Check.
(()=>{
  const load=(src,id)=>new Promise(resolve=>{
    if(document.getElementById(id))return resolve(true);
    const s=document.createElement('script');s.id=id;s.src=src;s.async=false;s.onload=()=>resolve(true);s.onerror=()=>resolve(false);document.body.appendChild(s);
  });
  async function boot(){
    await load('./brand-config.js','jfm-brand-config-v9');
    await load('./brand-runtime-v9.js','jfm-brand-runtime-v9');
    await load('./progress-clock-v226.js','jfm-progress-v226');
    await load('./mair-dj-v2.js','mair-dj-v2');
    await load('./mair-voice-check.js','mair-voice-check-v1');
    setTimeout(()=>load('./beta-status.js','jfm-beta-status-v8'),2600);
  }
  boot();
  window.JFMV226Bootstrap={version:'mair-dj-v2-bootstrap',get ready(){return !!(window.MAIRDJ&&window.JFMProgressClock)}};
})();
