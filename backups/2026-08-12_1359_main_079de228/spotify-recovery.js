// Josh FM Spotify recovery compatibility shim.
// Playback ownership lives in playback-primary.js; this file must never bind transport buttons or create a Spotify.Player.
(()=>{
  const call=(name,...args)=>{
    const p=window.JFMPlayback;
    if(!p||p.primary!==true||typeof p[name]!=='function')return Promise.resolve(false);
    try{return Promise.resolve(p[name](...args))}catch{return Promise.resolve(false)}
  };
  window.JFMSpotifyRecovery={
    version:'recovery-v6-delegated',
    recover:(reason='compat',opts={})=>call('recover',reason,opts),
    start:()=>call('start'),
    next:()=>call('next'),
    previous:()=>call('previous'),
    playPause:()=>call('playPause'),
    pause:()=>call('pause'),
    resume:()=>call('resume'),
    playUri:uri=>call('playUri',uri),
    get controller(){return window.JFMPlayback||null}
  };
})();
