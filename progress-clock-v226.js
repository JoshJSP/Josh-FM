// Josh FM v2.2.6 local progress clock — keeps elapsed time moving between Spotify refreshes.
(()=>{
  const $=id=>document.getElementById(id);
  let trackId='',baseMs=0,anchor=performance.now(),playing=false,durationMs=0,lastRemoteMs=-1,lastRemotePlaying=null;
  const fmt=ms=>{const s=Math.max(0,Math.floor(Number(ms||0)/1000)),m=Math.floor(s/60);return `${m}:${String(s%60).padStart(2,'0')}`};
  function syncFromPlayback(){
    let p=null;try{p=playback}catch{}
    const id=String(p?.item?.id||''),remoteMs=Math.max(0,Number(p?.progress_ms||0)),remotePlaying=!!p?.is_playing,dur=Math.max(0,Number(p?.item?.duration_ms||0));
    if(!id)return;
    const changedTrack=id!==trackId,changedRemote=remoteMs!==lastRemoteMs,changedPlaying=remotePlaying!==lastRemotePlaying;
    if(changedTrack||changedRemote||changedPlaying){trackId=id;baseMs=remoteMs;anchor=performance.now();playing=remotePlaying;durationMs=dur;lastRemoteMs=remoteMs;lastRemotePlaying=remotePlaying;}
  }
  function tick(){
    syncFromPlayback();
    if(!trackId)return;
    let ms=baseMs+(playing?performance.now()-anchor:0);
    if(durationMs>0)ms=Math.min(ms,durationMs);
    const elapsed=$('elapsed'),fill=$('barFill'),duration=$('duration');
    if(elapsed)elapsed.textContent=fmt(ms);
    if(duration)duration.textContent=fmt(durationMs);
    if(fill)fill.style.width=(durationMs?Math.max(0,Math.min(100,ms/durationMs*100)):0)+'%';
  }
  const timer=setInterval(tick,250);
  window.addEventListener('pageshow',()=>{anchor=performance.now();syncFromPlayback();tick()});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){anchor=performance.now();syncFromPlayback();tick()}});
  window.JFMProgressClock={version:'v226-local-progress',sync:syncFromPlayback,tick,stop:()=>clearInterval(timer)};
})();
