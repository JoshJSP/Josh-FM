// Josh FM Product Beta Build 1 — passive radio-core health monitor.
(()=>{
  const MAX=120,events=[];
  let lastTrack='',lastTrackAt=0,lastDevice='',deviceFlaps=0,rapidTransitions=0,stalls=0,stallSince=0,lastSample={};
  const push=(type,extra={})=>{events.unshift({at:Date.now(),type,...extra});if(events.length>MAX)events.length=MAX};
  const state=()=>window.JFMPlaybackState?.get?.()||window.JFMPlayback?.state||null;
  const djBusy=()=>!!(window.JFMDJAuthoritative?.busy||window.JFMDJTransition?.busy||window.djBusy);
  function sample(){
    const s=state();if(!s)return;
    const device=String(s.deviceId||'');
    if(device&&lastDevice&&device!==lastDevice){deviceFlaps++;push('device-change',{from:lastDevice,to:device})}
    if(device)lastDevice=device;
    const id=String(s.trackId||'');
    if(id&&id!==lastTrack){const now=Date.now();if(lastTrack&&now-lastTrackAt<700){rapidTransitions++;push('rapid-track-transition',{from:lastTrack,to:id,ms:now-lastTrackAt})}lastTrack=id;lastTrackAt=now}
    const stalled=!document.hidden&&navigator.onLine!==false&&!!s.expectedLive&&!s.isPlaying&&!djBusy()&&!window.JFMPlayback?.health?.busy;
    if(stalled){if(!stallSince)stallSince=Date.now();if(Date.now()-stallSince>15000&&!lastSample.stalled){stalls++;push('playback-stall',{trackId:id,device})}}else stallSince=0;
    lastSample={at:Date.now(),trackId:id,deviceId:device,isPlaying:!!s.isPlaying,expectedLive:!!s.expectedLive,djBusy:djBusy(),stalled:stalled&&Date.now()-stallSince>15000,recoveries:Number(window.JFMPlayback?.health?.recoveries||0),failures:Number(window.JFMPlayback?.health?.failures||0)};
  }
  window.addEventListener('jfm:trackchange',e=>push('trackchange',{trackId:e?.detail?.trackId||'',source:e?.detail?.source||''}));
  window.addEventListener('online',()=>push('online'));
  window.addEventListener('offline',()=>{stallSince=0;push('offline')});
  document.addEventListener('visibilitychange',()=>{stallSince=0;push(document.hidden?'background':'foreground')});
  setInterval(sample,2000);setTimeout(sample,600);
  window.JFMRadioCoreHealth={version:'build1-health-v1.1-background-safe',sample,events:()=>[...events],get state(){sample();return{...lastSample,deviceFlaps,rapidTransitions,stalls,eventCount:events.length}}};
})();