// iOS compatibility shim. Transport ownership lives exclusively in playback-primary.js.
(()=>{
  if(window.JFMIOSV2B02)return;
  const call=(name,...args)=>{
    const playback=window.JFMPlayback;
    if(!playback||playback.primary!==true||typeof playback[name]!=='function')return Promise.resolve(false);
    try{return Promise.resolve(playback[name](...args))}catch{return Promise.resolve(false)}
  };
  window.JFMIOSV2B02={
    version:'v2b.0.2-delegated-single-owner',
    toggle:()=>call('playPause'),
    pause:()=>call('pause'),
    resume:()=>call('resume'),
    get busy(){return !!window.JFMPlayback?.health?.busy}
  };
})();
