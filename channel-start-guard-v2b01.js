// Josh FM v2b.0.1 — make channel playback resilient to transient transport locks on iPhone.
(()=>{
  if(window.JFMChannelStartGuard)return;
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  let wrapped=false;
  function activate(){try{window.jfmSpotifyPlayer?.activateElement?.()}catch{}}
  function install(){
    const p=window.JFMPlayback;
    if(!p||wrapped||typeof p.playUri!=='function')return false;
    const original=p.playUri.bind(p);
    p.playUri=async uri=>{
      let last=false;
      for(let attempt=0;attempt<4;attempt++){
        const h=p.health||{};
        if(h.busy||h.endGuardBusy||h.djBusy){await wait(220+attempt*180);continue}
        last=await original(uri);
        if(last===true)return true;
        await wait(300+attempt*250);
      }
      return last;
    };
    wrapped=true;
    return true;
  }
  document.addEventListener('click',e=>{if(e.target?.closest?.('[data-jfm-channel]'))activate()},true);
  let tries=0;const boot=()=>{if(install())return;if(++tries<100)setTimeout(boot,100)};boot();
  window.addEventListener('pageshow',()=>{wrapped=false;tries=0;setTimeout(boot,100)});
  window.JFMChannelStartGuard={version:'v2b.0.1',install,activate,get wrapped(){return wrapped}};
})();
